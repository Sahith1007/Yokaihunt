// frontend/src/services/algo.js
// Algorand wallet service for Pera and Defly

import algosdk from 'algosdk';

const ALGOD_URL = process.env.NEXT_PUBLIC_ALGOD_URL || 'https://testnet-api.algonode.cloud';
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://testnet-idx.algonode.cloud';

let algodClient = null;
let indexerClient = null;

function getAlgodClient() {
  if (!algodClient) {
    algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
  }
  return algodClient;
}

function getIndexerClient() {
  if (!indexerClient) {
    indexerClient = new algosdk.Indexer('', INDEXER_URL, '');
  }
  return indexerClient;
}

/**
 * Connect wallet (Pera or Defly)
 * @returns {Promise<string>} Wallet address
 */
export async function connectWallet() {
  try {
    // Try Pera Wallet first
    if (typeof window !== 'undefined' && window.PeraWallet) {
      const peraWallet = new window.PeraWallet();
      const accounts = await peraWallet.connect();
      if (accounts && accounts.length > 0) {
        localStorage.setItem('algorand_wallet_address', accounts[0]);
        localStorage.setItem('algorand_wallet_provider', 'pera');
        return accounts[0];
      }
    }

    // Try Defly Wallet
    if (typeof window !== 'undefined' && window.defly) {
      const accounts = await window.defly.connect();
      if (accounts && accounts.length > 0) {
        localStorage.setItem('algorand_wallet_address', accounts[0]);
        localStorage.setItem('algorand_wallet_provider', 'defly');
        return accounts[0];
      }
    }

    throw new Error('No wallet provider found. Please install Pera Wallet or Defly Wallet.');
  } catch (error) {
    console.error('Wallet connection error:', error);
    throw error;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet() {
  try {
    const provider = localStorage.getItem('algorand_wallet_provider');
    
    if (provider === 'pera' && typeof window !== 'undefined' && window.PeraWallet) {
      const peraWallet = new window.PeraWallet();
      await peraWallet.disconnect();
    }
    
    if (provider === 'defly' && typeof window !== 'undefined' && window.defly) {
      await window.defly.disconnect();
    }
    
    localStorage.removeItem('algorand_wallet_address');
    localStorage.removeItem('algorand_wallet_provider');
  } catch (error) {
    console.error('Wallet disconnection error:', error);
  }
}

/**
 * Sign opt-in transaction for asset
 * @param {string} assetId - Asset ID to opt into
 * @returns {Promise<string>} Transaction ID
 */
export async function signOptIn(assetId) {
  try {
    const walletAddress = localStorage.getItem('algorand_wallet_address');
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    const algod = getAlgodClient();
    const suggestedParams = await algod.getTransactionParams().do();

    // Create opt-in transaction (transfer 0 to self)
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: walletAddress,
      to: walletAddress,
      amount: 0,
      assetIndex: Number(assetId),
      suggestedParams,
    });

    // Get provider and sign
    const provider = localStorage.getItem('algorand_wallet_provider');
    let signedTxn;

    if (provider === 'pera' && typeof window !== 'undefined' && window.PeraWallet) {
      const peraWallet = new window.PeraWallet();
      signedTxn = await peraWallet.signTransaction([{ txn }]);
    } else if (provider === 'defly' && typeof window !== 'undefined' && window.defly) {
      signedTxn = await window.defly.signTransaction([{ txn }]);
    } else {
      throw new Error('Wallet provider not supported');
    }

    // Send transaction
    const { txId } = await algod.sendRawTransaction(signedTxn).do();
    return txId;
  } catch (error) {
    console.error('Opt-in error:', error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation
 * @param {string} txId - Transaction ID
 * @param {number} timeout - Timeout in rounds (default 10)
 * @returns {Promise<Object>} Confirmed transaction
 */
export async function waitForConfirmation(txId, timeout = 10) {
  const algod = getAlgodClient();
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
 * Verify ownership of asset
 * @param {string} assetId - Asset ID
 * @param {string} walletAddress - Wallet address to check
 * @returns {Promise<boolean>}
 */
export async function verifyOwnership(assetId, walletAddress) {
  try {
    const indexer = getIndexerClient();
    const accountInfo = await indexer.lookupAccountByID(walletAddress).do();
    const asset = accountInfo.account?.assets?.find(
      (a) => a['asset-id'] === Number(assetId) && a.amount > 0
    );
    return !!asset;
  } catch (error) {
    console.error('Ownership verification error:', error);
    return false;
  }
}

/**
 * Get connected wallet address
 * @returns {string|null}
 */
export function getConnectedWallet() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('algorand_wallet_address');
}

/**
 * Check if wallet is connected
 * @returns {boolean}
 */
export function isWalletConnected() {
  return !!getConnectedWallet();
}

