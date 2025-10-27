/**
 * Algorand Service
 * Handles all interactions with Yokai Hunt smart contracts on Algorand
 */

const algosdk = require('algosdk');

class AlgorandService {
  constructor() {
    // Load configuration from environment
    this.algodToken = process.env.ALGOD_TOKEN || '';
    this.algodServer = process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
    this.algodPort = process.env.ALGOD_PORT || 443;
    
    // Initialize Algod client
    this.algodClient = new algosdk.Algodv2(
      this.algodToken,
      this.algodServer,
      this.algodPort
    );
    
    // Contract application IDs (set from deployment)
    this.nftAppId = parseInt(process.env.NFT_CONTRACT_ID || '0');
    this.marketplaceAppId = parseInt(process.env.MARKETPLACE_CONTRACT_ID || '0');
    this.evolutionAppId = parseInt(process.env.EVOLUTION_CONTRACT_ID || '0');
    this.yieldAppId = parseInt(process.env.YIELD_CONTRACT_ID || '0');
    
    // Backend admin account (signs transactions)
    const adminMnemonic = process.env.ADMIN_MNEMONIC;
    if (adminMnemonic) {
      this.adminAccount = algosdk.mnemonicToSecretKey(adminMnemonic);
    } else {
      console.warn('⚠️  ADMIN_MNEMONIC not set - minting will not work');
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txId, timeout = 10) {
    const status = await this.algodClient.status().do();
    let lastRound = status['last-round'];
    
    while (true) {
      const pendingInfo = await this.algodClient.pendingTransactionInformation(txId).do();
      
      if (pendingInfo['confirmed-round'] !== null && pendingInfo['confirmed-round'] > 0) {
        return pendingInfo;
      }
      
      if (pendingInfo['pool-error']) {
        throw new Error(`Transaction pool error: ${pendingInfo['pool-error']}`);
      }
      
      lastRound += 1;
      await this.algodClient.statusAfterBlock(lastRound).do();
      
      if (lastRound > status['last-round'] + timeout) {
        throw new Error(`Transaction not confirmed after ${timeout} rounds`);
      }
    }
  }

  /**
   * Mint a Yokai NFT after player catches one
   * 
   * @param {Object} yokaiData - Pokemon data from catch
   * @param {string} playerAddress - Player's Algorand address
   * @returns {Promise<{assetId: number, txId: string}>}
   */
  async mintYokaiNFT(yokaiData, playerAddress) {
    if (!this.adminAccount) {
      throw new Error('Admin account not configured');
    }

    if (!this.nftAppId) {
      throw new Error('NFT contract not deployed. Set NFT_CONTRACT_ID in .env');
    }

    try {
      const params = await this.algodClient.getTransactionParams().do();
      
      // Prepare method args for mint_yokai
      const appArgs = [
        new Uint8Array(Buffer.from('mint_yokai')),
        this.encodeString(yokaiData.name),
        this.encodeString(yokaiData.rarity || 'Common'),
        this.encodeString(yokaiData.type || 'Normal'),
        this.encodeUint16(yokaiData.attack || 50),
        this.encodeUint16(yokaiData.defense || 50),
        this.encodeUint16(yokaiData.speed || 50),
        this.encodeUint16(yokaiData.hp || 50),
        this.encodeUint16(yokaiData.yieldStat || 0),
        this.encodeUint8(yokaiData.level || 1),
        this.encodeUint8(yokaiData.evolutionStage || 0),
        this.encodeString(yokaiData.imageUrl || ''),
        this.encodeString(yokaiData.description || ''),
        this.encodeBool(yokaiData.isLegendary || false),
        algosdk.decodeAddress(playerAddress).publicKey
      ];

      // Create application call transaction
      const txn = algosdk.makeApplicationNoOpTxn(
        this.adminAccount.addr,
        params,
        this.nftAppId,
        appArgs
      );

      // Sign and send
      const signedTxn = txn.signTxn(this.adminAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      console.log(`🎨 Minting Yokai NFT... Txn ID: ${txId}`);
      
      // Wait for confirmation
      const confirmedTxn = await this.waitForConfirmation(txId);
      
      // Extract asset ID from logs or inner transactions
      // Note: This depends on how the contract returns the asset ID
      const assetId = this.extractAssetIdFromTxn(confirmedTxn);
      
      console.log(`✅ Minted ${yokaiData.name} as NFT #${assetId}`);
      
      return {
        assetId,
        txId,
        appId: this.nftAppId
      };
      
    } catch (error) {
      console.error('❌ Failed to mint Yokai NFT:', error);
      throw error;
    }
  }

  /**
   * Get NFT metadata from contract
   */
  async getYokaiMetadata(assetId) {
    try {
      const appArgs = [
        new Uint8Array(Buffer.from('get_metadata')),
        this.encodeUint64(assetId)
      ];

      // This is a read-only call, no transaction needed
      // In production, you'd use the indexer or app global state
      const accountInfo = await this.algodClient.accountInformation(
        algosdk.getApplicationAddress(this.nftAppId)
      ).do();
      
      // Parse box storage or global state for metadata
      // This is simplified - actual implementation depends on contract structure
      
      return {
        assetId,
        // metadata fields...
      };
      
    } catch (error) {
      console.error('Failed to get metadata:', error);
      throw error;
    }
  }

  /**
   * Check if a legendary has been minted
   */
  async isLegendaryMinted(pokemonName) {
    try {
      const appArgs = [
        new Uint8Array(Buffer.from('is_legendary_minted')),
        this.encodeString(pokemonName)
      ];

      // Read-only call to check legendary registry
      // Implementation depends on how you want to query the contract
      
      return false; // Placeholder
      
    } catch (error) {
      console.error('Failed to check legendary status:', error);
      return false;
    }
  }

  /**
   * List NFT on marketplace
   */
  async listOnMarketplace(assetId, priceInAlgos, sellerAddress) {
    // Implementation for listing on marketplace
    // Requires player to sign transaction transferring NFT to marketplace
    // and calling list_nft method
    
    throw new Error('Not implemented - requires player signature');
  }

  /**
   * Evolve a Yokai (admin only - after verifying player has required NFTs)
   */
  async evolveYokai(evolutionData, playerAddress) {
    if (!this.adminAccount) {
      throw new Error('Admin account not configured');
    }

    try {
      const params = await this.algodClient.getTransactionParams().do();
      
      const appArgs = [
        new Uint8Array(Buffer.from('evolve_yokai')),
        this.encodeString(evolutionData.baseSpecies),
        this.encodeUint8(evolutionData.targetStage),
        // ... more args for evolution
      ];

      const txn = algosdk.makeApplicationNoOpTxn(
        this.adminAccount.addr,
        params,
        this.evolutionAppId,
        appArgs
      );

      const signedTxn = txn.signTxn(this.adminAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      const confirmedTxn = await this.waitForConfirmation(txId);
      const evolvedAssetId = this.extractAssetIdFromTxn(confirmedTxn);
      
      console.log(`✅ Evolved to NFT #${evolvedAssetId}`);
      
      return { evolvedAssetId, txId };
      
    } catch (error) {
      console.error('Failed to evolve Yokai:', error);
      throw error;
    }
  }

  /**
   * Helper: Encode string for ARC4
   */
  encodeString(str) {
    const encoded = new Uint8Array(Buffer.from(str, 'utf8'));
    const length = new Uint8Array(2);
    length[0] = (encoded.length >> 8) & 0xFF;
    length[1] = encoded.length & 0xFF;
    return new Uint8Array([...length, ...encoded]);
  }

  /**
   * Helper: Encode uint64
   */
  encodeUint64(num) {
    const arr = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      arr[i] = num & 0xFF;
      num = Math.floor(num / 256);
    }
    return arr;
  }

  /**
   * Helper: Encode uint16
   */
  encodeUint16(num) {
    return new Uint8Array([(num >> 8) & 0xFF, num & 0xFF]);
  }

  /**
   * Helper: Encode uint8
   */
  encodeUint8(num) {
    return new Uint8Array([num & 0xFF]);
  }

  /**
   * Helper: Encode boolean
   */
  encodeBool(bool) {
    return new Uint8Array([bool ? 1 : 0]);
  }

  /**
   * Helper: Extract asset ID from transaction
   */
  extractAssetIdFromTxn(txn) {
    // Look for created asset in inner transactions or logs
    if (txn['inner-txns'] && txn['inner-txns'].length > 0) {
      for (const innerTxn of txn['inner-txns']) {
        if (innerTxn['asset-index']) {
          return innerTxn['asset-index'];
        }
      }
    }
    
    // Fallback: check logs for asset ID
    if (txn['logs'] && txn['logs'].length > 0) {
      // Parse logs for asset ID (implementation specific to contract)
      const lastLog = txn['logs'][txn['logs'].length - 1];
      // Decode log to extract uint64 asset ID
      const buffer = Buffer.from(lastLog, 'base64');
      if (buffer.length >= 8) {
        let assetId = 0;
        for (let i = 0; i < 8; i++) {
          assetId = assetId * 256 + buffer[i];
        }
        return assetId;
      }
    }
    
    return null;
  }

  /**
   * Get player's NFT portfolio from Algorand
   */
  async getPlayerNFTs(playerAddress) {
    try {
      const accountInfo = await this.algodClient.accountInformation(playerAddress).do();
      
      // Filter for Yokai NFTs (unit name = "YOKAI")
      const yokaiAssets = accountInfo.assets
        .filter(asset => asset.amount > 0)
        .map(asset => ({
          assetId: asset['asset-id'],
          amount: asset.amount
        }));
      
      // Fetch metadata for each asset
      const nftsWithMetadata = await Promise.all(
        yokaiAssets.map(async ({ assetId }) => {
          try {
            const assetInfo = await this.algodClient.getAssetByID(assetId).do();
            const metadata = await this.getYokaiMetadata(assetId);
            
            return {
              assetId,
              name: assetInfo.params.name,
              unitName: assetInfo.params['unit-name'],
              url: assetInfo.params.url,
              metadata
            };
          } catch (err) {
            console.error(`Failed to fetch asset ${assetId}:`, err);
            return null;
          }
        })
      );
      
      return nftsWithMetadata.filter(nft => nft !== null);
      
    } catch (error) {
      console.error('Failed to get player NFTs:', error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new AlgorandService();
