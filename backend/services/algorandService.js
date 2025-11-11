// backend/services/algorandService.js (ESM)
import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL;
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const INDEXER_URL = process.env.ALGOD_INDEXER || process.env.ALGOD_INDEXER_URL;
const CREATOR_MNEMONIC = process.env.CREATOR_MNEMONIC;

if (!ALGOD_URL || !INDEXER_URL) throw new Error('ALGOD_URL and ALGOD_INDEXER(_URL) required');
if (!CREATOR_MNEMONIC) console.warn('CREATOR_MNEMONIC not set - mint/update will fail');

export const CREATOR_ACCOUNT = CREATOR_MNEMONIC ? algosdk.mnemonicToSecretKey(CREATOR_MNEMONIC) : null;
export const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');
export const indexerClient = new algosdk.Indexer('', INDEXER_URL, '');

export async function waitForConfirmation(txId, timeout = 20) {
  const status = await algodClient.status().do();
  let lastRound = status['last-round'];
  for (let i = 0; i < timeout; i++) {
    const pending = await algodClient.pendingTransactionInformation(txId).do();
    if (pending && pending['confirmed-round'] && pending['confirmed-round'] > 0) return pending;
    lastRound++;
    await algodClient.statusAfterBlock(lastRound).do();
  }
  throw new Error('Transaction not confirmed in time');
}

export async function mintASA({ metadataUrl, unitName = 'YOKAI', assetName = 'YokaiHunt NFT' }) {
  if (!CREATOR_ACCOUNT) throw new Error('Creator not configured');
  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: CREATOR_ACCOUNT.addr,
    total: 1,
    decimals: 0,
    defaultFrozen: false,
    unitName,
    assetName,
    assetURL: metadataUrl,
    manager: CREATOR_ACCOUNT.addr,
    reserve: CREATOR_ACCOUNT.addr,
    freeze: undefined,
    clawback: CREATOR_ACCOUNT.addr,
    suggestedParams: params,
  });
  const signed = txn.signTxn(CREATOR_ACCOUNT.sk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await waitForConfirmation(txId);
  const ptx = await algodClient.pendingTransactionInformation(txId).do();
  const assetId = ptx['asset-index'] || ptx['created-asset-index'];
  return { assetId, txId };
}

export async function transferAsset({ assetId, fromSk, fromAddr, toAddr }) {
  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAddr,
    to: toAddr,
    amount: 1,
    assetIndex: Number(assetId),
    suggestedParams: params,
  });
  const signed = txn.signTxn(fromSk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await waitForConfirmation(txId);
  return { txId };
}

export async function updateAssetMetadata({ assetId, newMetadataUrl }) {
  if (!CREATOR_ACCOUNT) throw new Error('Creator not configured');
  const params = await algodClient.getTransactionParams().do();
  const info = await indexerClient.lookupAssetByID(Number(assetId)).do();
  const unitName = info?.asset?.params?.['unit-name'] || 'YOKAI';
  const assetName = info?.asset?.params?.name || 'YokaiHunt NFT';
  const txn = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
    from: CREATOR_ACCOUNT.addr,
    assetIndex: Number(assetId),
    strictEmptyAddressCheck: false,
    manager: CREATOR_ACCOUNT.addr,
    reserve: CREATOR_ACCOUNT.addr,
    freeze: undefined,
    clawback: CREATOR_ACCOUNT.addr,
    assetURL: newMetadataUrl,
    unitName,
    assetName,
    suggestedParams: params,
  });
  const signed = txn.signTxn(CREATOR_ACCOUNT.sk);
  const { txId } = await algodClient.sendRawTransaction(signed).do();
  await waitForConfirmation(txId);
  return { txId };
}

export async function getAccountAssets(address) {
  const acct = await indexerClient.lookupAccountByID(address).do();
  return acct?.account?.assets || [];
