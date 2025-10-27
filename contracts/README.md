# Yokai Hunt - Algorand Smart Contracts

Complete smart contract system for minting, trading, evolving, and staking Pokémon (Yokai) NFTs on Algorand.

## 📋 Contract Overview

### 1. **YokaiNFT Contract** (`yokai_nft.py`)
Handles minting and ownership of Yokai NFTs with:
- ✅ Metadata storage in Box storage
- ✅ Legendary enforcement (1/1 NFTs - only ONE of each legendary can exist)
- ✅ Trade enable/disable flags
- ✅ ARC-19/ARC-69 compliant metadata

### 2. **YokaiMarketplace Contract** (`yokai_marketplace.py`)
Decentralized marketplace for trading Yokai NFTs:
- ✅ List NFTs with custom prices (in microAlgos)
- ✅ Buy/sell with automatic transfers
- ✅ Platform fee system (default 2%)
- ✅ Delist functionality

### 3. **YokaiEvolution Contract** (`yokai_evolution.py`)
Evolution system through NFT burning:
- ✅ Burn 2 NFTs for 1st evolution
- ✅ Burn 4 NFTs for 2nd evolution
- ✅ Stat boosts (10-20% per evolution)
- ✅ Evolution lineage tracking

### 4. **YokaiYield Contract** (`yokai_yield.py`)
Staking system for yield generation:
- ✅ Stake evolved NFTs to earn $YOKA tokens
- ✅ Daily yield based on evolution stage and rarity
- ✅ Claim accumulated rewards
- ✅ Unstake anytime

## 🚀 Quick Start

```bash
# Install dependencies
pip install algorand-python py-algorand-sdk

# Compile contracts
algokit compile python yokai_nft.py

# Deploy to TestNet
cd scripts && python deploy.py --network testnet
```

## 📚 Full Documentation

See individual contract files for detailed method documentation.
See `metadata/` folder for NFT metadata schemas and examples.

## 🎯 Success Criteria

- [x] Full mint → trade → evolve → stake flow
- [x] Legendary enforcement (max 1 per species)
- [x] Modular, auditable contracts
- [x] Future-ready yield system
