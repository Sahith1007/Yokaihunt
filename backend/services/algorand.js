import algosdk from 'algosdk';

function getAlgod() {
  const token = process.env.ALGOD_TOKEN || '';
  const server = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const port = process.env.ALGOD_PORT ? Number(process.env.ALGOD_PORT) : undefined;
  return new algosdk.Algodv2(token, server, port);
}

export async function updateXPOnChain({ appId, wallet, xp }) {
  // Stateless call signed by backend account (creator or admin)
  const algod = getAlgod();
  const adminMnemonic = process.env.ALGORAND_CREATOR_MNEMONIC;
  if (!adminMnemonic) throw new Error('Missing admin mnemonic');
  const acct = algosdk.mnemonicToSecretKey(adminMnemonic);

  const sp = await algod.getTransactionParams().do();
  const args = [new Uint8Array(Buffer.from('xp_update')), algosdk.encodeUint64(Number(xp))];

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: acct.addr,
    appIndex: Number(appId),
    appArgs: args,
    suggestedParams: sp,
    accounts: [wallet], // pass player wallet as foreign account if needed
  });

  const signed = txn.signTxn(acct.sk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txId, 4);
  return { txId };
}

function getIndexer() {
  const server = process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud';
  return new algosdk.Indexer('', server, undefined);
}

export async function verifyWalletSignature({ address, message, signature }) {
  try {
    if (!address || !message || !signature) return false;
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signature, 'base64');
    return algosdk.verifyBytes(msgBytes, sigBytes, address);
  } catch {
    return false;
  }
}

export async function mintASAWithIPFS({ fromSk, fromAddr, unitName, assetName, decimals = 0, total = 1, cid }) {
  const algod = getAlgod();
  const suggestedParams = await algod.getTransactionParams().do();

  // For simplicity use ARC-3 style URL pointing to IPFS; ARC-19 support can be added later via template URL
  const url = `ipfs://${cid}`;

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: fromAddr,
    total,
    decimals,
    assetName,
    unitName,
    defaultFrozen: false,
    manager: fromAddr,
    reserve: fromAddr,
    freeze: undefined,
    clawback: fromAddr,
    assetURL: url,
    note: new TextEncoder().encode(JSON.stringify({ ipfs: cid, std: 'arc19' })),
    suggestedParams,
  });

  const signed = txn.signTxn(fromSk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txId, 4);
  const ptx = await algod.pendingTransactionInformation(txId).do();
  const assetId = ptx['asset-index'];
  return { txId, assetId };
}

export async function transferASA({ assetId, fromSk, fromAddr, toAddr, amount = 1 }) {
  const algod = getAlgod();
  const sp = await algod.getTransactionParams().do();

  // Ensure receiver is opted-in
  const holding = await getIndexer().lookupAccountAssets(toAddr).assetId(assetId).do().catch(() => null);
  const optedIn = !!(holding && holding.assets && holding.assets.length);
  if (!optedIn) {
    const optinTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: toAddr,
      to: toAddr,
      assetIndex: assetId,
      amount: 0,
      suggestedParams: sp,
    });
    throw new Error('Receiver must opt-in before transfer');
  }

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAddr,
    to: toAddr,
    amount,
    assetIndex: assetId,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(fromSk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txId, 4);
  return { txId };
}

export async function burnASA({ assetId, managerSk, managerAddr }) {
  const algod = getAlgod();
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
    from: managerAddr,
    assetIndex: assetId,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(managerSk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txId, 4);
  return { txId };
}

export async function listWalletNFTs({ wallet }) {
  const idx = getIndexer();
  const res = await idx.lookupAccountAssets(wallet).do();
  const assets = res.assets || [];
  // Filter NFTs: decimals 0 and total 1 typically, but include all for now
  return assets.map(a => ({
    assetId: a['asset-id'],
    amount: a.amount,
    isFrozen: a['is-frozen'],
  }));
}