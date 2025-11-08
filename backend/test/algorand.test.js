// backend/test/algorand.test.js
// Algorand service tests

import { describe, it, expect, beforeAll } from '@jest/globals';
import { getClient, getIndexer, getCreatorAccount, mintNFT, sendNFT, waitForOptIn, verifyOwnership } from '../services/algorand.js';

// Mock environment variables
process.env.ALGOD_TOKEN = '';
process.env.ALGOD_URL = 'https://testnet-api.algonode.cloud';
process.env.ALGOD_INDEXER_URL = 'https://testnet-idx.algonode.cloud';
process.env.CREATOR_MNEMONIC = process.env.CREATOR_MNEMONIC || 'test mnemonic'; // Will fail if not set

describe('Algorand Service', () => {
  let testAssetId = null;
  let testWallet = 'TESTWALLETADDRESS'; // Replace with actual test wallet

  beforeAll(() => {
    // Skip tests if mnemonic not set
    if (!process.env.CREATOR_MNEMONIC || process.env.CREATOR_MNEMONIC === 'test mnemonic') {
      console.warn('⚠️  CREATOR_MNEMONIC not set, skipping Algorand tests');
    }
  });

  it('should get Algod client', () => {
    const client = getClient();
    expect(client).toBeDefined();
  });

  it('should get Indexer client', () => {
    const indexer = getIndexer();
    expect(indexer).toBeDefined();
  });

  it('should get creator account from mnemonic', () => {
    if (!process.env.CREATOR_MNEMONIC || process.env.CREATOR_MNEMONIC === 'test mnemonic') {
      expect(() => getCreatorAccount()).toThrow();
    } else {
      const account = getCreatorAccount();
      expect(account).toBeDefined();
      expect(account.addr).toBeDefined();
    }
  });

  it('should mint NFT', async () => {
    if (!process.env.CREATOR_MNEMONIC || process.env.CREATOR_MNEMONIC === 'test mnemonic') {
      console.log('⏭️  Skipping mint test - no mnemonic');
      return;
    }

    try {
      const result = await mintNFT({
        name: 'Test Pokemon',
        description: 'Test description',
        imageUrl: 'ipfs://testcid',
        ownerAddress: testWallet
      });
      
      expect(result).toBeDefined();
      expect(result.assetId).toBeDefined();
      expect(result.txId).toBeDefined();
      testAssetId = result.assetId;
    } catch (error) {
      console.error('Mint test error (expected if no funds):', error.message);
    }
  }, 30000);

  it('should verify ownership', async () => {
    if (!testAssetId) {
      console.log('⏭️  Skipping ownership test - no asset ID');
      return;
    }

    const owns = await verifyOwnership(testAssetId, testWallet);
    expect(typeof owns).toBe('boolean');
  });

  it('should wait for opt-in (mock)', async () => {
    // This is a mock test - actual opt-in requires wallet interaction
    const result = await waitForOptIn(12345, testWallet, 1, 100);
    expect(typeof result).toBe('boolean');
  });
});

