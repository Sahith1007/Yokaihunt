// backend/services/algorand.js
// Comprehensive Algorand service for NFT minting and transactions

import algosdk from 'algosdk';

/**
 * Get Algod client
 */
export function getClient() {
  const token = process.env.ALGOD_TOKEN || '';
  const server = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const port = process.env.ALGOD_PORT ? Number(process.env.ALGOD_PORT) : undefined;
  return new algosdk.Algodv2(token, server, port);
}

/**
 * Get Indexer client
 */
export function getIndexer() {
  const server = process.env.ALGOD_INDEXER_URL || 'https://testnet-idx.algonode.cloud';
  return new algosdk.Indexer('', server, undefined);
}

/**
 * Get creator account from mnemonic
 */
export function getCreatorAccount() {
  const mnemonic = process.env.CREATOR_MNEMONIC;
  if (!mnemonic) {
    throw new Error('CREATOR_MNEMONIC not set in environment');
  }
  return algosdk.mnemonicToSecretKey(mnemonic);
}

/**
 * Wait for transaction confirmation
 */
export async function confirmTx(txId, timeout = 10) {
  const algod = getClient();
  const status = await algod.status().do();
  let lastRound = status['last-round'];
  const startRound = lastRound;

  while (lastRound < startRound + timeout) {
    try {
      const pendingInfo = await algod.pendingTransactionInformation(txId).do();
      if (pendingInfo['confirmed-round'] && pendingInfo['confirmed-round'] > 0) {
        return pendingInfo;
      }
    } catch (e) {
      // Transaction not found yet, continue waiting
    }
    await algod.statusAfterBlock(lastRound + 1).do();
    lastRound++;
  }
  throw new Error(`Transaction ${txId} not confirmed within ${timeout} rounds`);
}

/**
 * Mint NFT ASA
 * @param {Object} params - { name, description, imageUrl, ownerAddress }
 * @returns {Promise<{assetId: number, txId: string}>}
 */
export async function mintNFT({ name, description, imageUrl, ownerAddress }) {
  const algod = getClient();
  const creator = getCreatorAccount();
  const suggestedParams = await algod.getTransactionParams().do();

  // Create asset creation transaction
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: creator.addr,
    total: 1,
    decimals: 0,
    defaultFrozen: false,
    unitName: 'PKMN',
    assetName: name,
    assetURL: imageUrl, // IPFS URL
    note: new TextEncoder().encode(JSON.stringify({
      description,
      standard: 'arc3'
    })),
    suggestedParams,
  });

  const signed = txn.signTxn(creator.sk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  
  // Wait for confirmation
  const confirmed = await confirmTx(txId);
  const assetId = confirmed['asset-index'] || confirmed['created-asset-index'];
  
  if (!assetId) {
    throw new Error('Failed to extract asset ID from transaction');
  }

  return { assetId, txId };
}

/**
 * Create unsigned opt-in transaction
 * @param {string} assetId - Asset ID
 * @param {string} walletAddress - Wallet address to opt in
 * @returns {Promise<Uint8Array>} Unsigned transaction bytes
 */
export async function createOptInTransaction(assetId, walletAddress) {
  const algod = getClient();
  const suggestedParams = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: walletAddress,
    to: walletAddress,
    amount: 0,
    assetIndex: Number(assetId),
    suggestedParams,
  });

  return algosdk.encodeUnsignedTransaction(txn);
}

/**
 * Submit signed transaction
 * @param {Uint8Array} signedTxn - Signed transaction bytes
 * @returns {Promise<{txId: string}>}
 */
export async function submitSignedTransaction(signedTxn) {
  const algod = getClient();
  const { txId } = await algod.sendRawTransaction(signedTxn).do();
  await confirmTx(txId);
  return { txId };
}

/**
 * Send NFT to recipient (requires opt-in first)
 * @param {Object} params - { assetId, to }
 * @returns {Promise<{txId: string}>}
 */
export async function sendNFT({ assetId, to }) {
  const algod = getClient();
  const creator = getCreatorAccount();
  const suggestedParams = await algod.getTransactionParams().do();

  // Check if recipient has opted in
  const indexer = getIndexer();
  try {
    const accountInfo = await indexer.lookupAccountByID(to).do();
    const hasAsset = accountInfo.account?.assets?.some(
      (asset: any) => asset['asset-id'] === assetId
    );
    
    if (!hasAsset) {
      throw new Error('RECIPIENT_NOT_OPTED_IN');
    }
  } catch (e) {
    if (e.message === 'RECIPIENT_NOT_OPTED_IN') throw e;
    // Account might not exist yet, assume not opted in
    throw new Error('RECIPIENT_NOT_OPTED_IN');
  }

  // Transfer asset
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: creator.addr,
    to: to,
    amount: 1,
    assetIndex: assetId,
    suggestedParams,
  });

  const signed = txn.signTxn(creator.sk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await confirmTx(txId);
  
  return { txId };
}

/**
 * Poll indexer until recipient has opted into asset
 * @param {string} assetId - Asset ID
 * @param {string} walletAddress - Wallet address to check
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} intervalMs - Polling interval in milliseconds
 * @returns {Promise<boolean>}
 */
export async function waitForOptIn(assetId, walletAddress, maxAttempts = 30, intervalMs = 2000) {
  const indexer = getIndexer();
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const accountInfo = await indexer.lookupAccountByID(walletAddress).do();
      const hasAsset = accountInfo.account?.assets?.some(
        (asset: any) => asset['asset-id'] === Number(assetId)
      );
      
      if (hasAsset) {
        return true;
      }
    } catch (e) {
      // Account might not exist or error, continue polling
    }
    
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  return false;
}

/**
 * Verify ownership of asset
 * @param {string} assetId - Asset ID
 * @param {string} walletAddress - Wallet address to check
 * @returns {Promise<boolean>}
 */
export async function verifyOwnership(assetId, walletAddress) {
  try {
    const indexer = getIndexer();
    const accountInfo = await indexer.lookupAccountByID(walletAddress).do();
    const asset = accountInfo.account?.assets?.find(
      (a: any) => a['asset-id'] === Number(assetId) && a.amount > 0
    );
    return !!asset;
  } catch {
    return false;
  }
}

// Legacy exports for backward compatibility
export async function mintASAWithIPFS({ fromSk, fromAddr, unitName, assetName, decimals = 0, total = 1, cid }) {
  const algod = getClient();
  const suggestedParams = await algod.getTransactionParams().do();
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
  await confirmTx(txId);
  const ptx = await algod.pendingTransactionInformation(txId).do();
  const assetId = ptx['asset-index'];
  return { txId, assetId };
}

export async function transferASA({ assetId, fromSk, fromAddr, toAddr, amount = 1 }) {
  const algod = getClient();
  const sp = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAddr,
    to: toAddr,
    amount,
    assetIndex: assetId,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(fromSk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await confirmTx(txId);
  return { txId };
}
