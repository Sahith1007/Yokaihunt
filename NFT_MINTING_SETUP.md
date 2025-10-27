# NFT Minting Feature - Setup Guide

## 🎯 Overview

This guide will help you set up the complete NFT minting flow for YokaiHunt, where catching Pokémon mints real NFTs on Algorand TestNet.

## 📋 Prerequisites

1. **Node.js** (v18+)
2. **Python** (v3.10+) for AlgoKit
3. **AlgoKit** - Algorand development toolkit
4. **PostgreSQL** or **MongoDB** for database
5. **Algorand TestNet Account** with funds

## 🚀 Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install Python dependencies for smart contract deployment
pip install algokit
pip install py-algorand-sdk

# Install Node dependencies (if not already done)
cd frontend
npm install algosdk @txnlab/use-wallet @perawallet/connect
cd ../backend
npm install algosdk prisma @prisma/client
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Algorand Configuration
ALGOD_TOKEN=
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_PORT=443
NETWORK=testnet

# Admin Account (will be generated if not provided)
ADMIN_MNEMONIC="your 25-word mnemonic phrase here"

# Contract Application IDs (set after deployment)
NFT_CONTRACT_ID=0
MARKETPLACE_CONTRACT_ID=0
EVOLUTION_CONTRACT_ID=0
YIELD_CONTRACT_ID=0

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/yokaihunt"
```

### 3. Generate Admin Account

Run the deployment script to create an admin account if you don't have one:

```bash
cd contracts/scripts
python deploy_nft.py
```

This will:
- Generate a new Algorand account
- Display the address and mnemonic
- Wait for you to fund the account

**⚠️ IMPORTANT**: Save the mnemonic securely! Add it to your `.env` file.

### 4. Fund Your Admin Account

Go to one of these TestNet dispensers and request ALGO:
- https://bank.testnet.algorand.network/
- https://testnet.algoexplorer.io/dispenser

You need at least **10 ALGO** for deployment and testing.

### 5. Compile Smart Contracts

```bash
# From project root
cd contracts

# Compile the NFT contract
algokit compile py yokai_nft.py

# This creates compiled TEAL artifacts
```

### 6. Deploy Smart Contracts to TestNet

**Option A: Using AlgoKit (Recommended)**

```bash
# Deploy using AlgoKit
algokit deploy

# Follow prompts and select TestNet
# Save the Application ID that's displayed
```

**Option B: Manual Deployment**

```bash
cd contracts/scripts
python deploy_nft.py
```

After deployment, update your `.env`:

```env
NFT_CONTRACT_ID=123456789  # Replace with your actual App ID
```

### 7. Set Up Database Schema

```bash
# Generate Prisma client
cd backend
npx prisma generate

# Run migrations
npx prisma migrate dev --name add_nft_tracking

# Or push schema directly
npx prisma db push
```

### 8. Configure Backend API

Make sure your backend server includes the NFT routes. In `backend/server.js` or `backend/index.js`:

```javascript
import nftRoutes from './routes/nft.js';

// Add this line with your other routes
app.use('/api/nft', nftRoutes);
```

### 9. Update Frontend

In `frontend/src/pages/index.jsx` or your main page, add wallet connection and starter selection:

```jsx
import { useEffect, useState } from 'react';
import { walletManager } from '../lib/wallet';
import StarterModal from '../components/StarterModal';
import NFTInventory from '../components/NFTInventory';

export default function HomePage() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [showStarterModal, setShowStarterModal] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  useEffect(() => {
    // Initialize wallet manager
    walletManager.initialize();

    // Check if wallet is connected
    const address = walletManager.getAddress();
    if (address) {
      setWalletAddress(address);
      localStorage.setItem('algorand_wallet_address', address);
      
      // Check if player needs to choose starter
      checkStarterStatus(address);
    }
  }, []);

  const connectWallet = async (providerId) => {
    const address = await walletManager.connect(providerId);
    if (address) {
      setWalletAddress(address);
      localStorage.setItem('algorand_wallet_address', address);
      
      // Show starter selection for new players
      checkStarterStatus(address);
    }
  };

  const checkStarterStatus = async (address) => {
    const userId = localStorage.getItem('user_id') || `user_${Date.now()}`;
    
    const response = await fetch(`/api/nft/check-starter/${userId}`);
    const result = await response.json();
    
    if (!result.hasStarter) {
      setShowStarterModal(true);
    }
  };

  return (
    <div>
      {/* Your existing UI */}
      
      {!walletAddress ? (
        <div>
          <button onClick={() => connectWallet('pera')}>
            Connect Pera Wallet
          </button>
          <button onClick={() => connectWallet('defly')}>
            Connect Defly Wallet
          </button>
        </div>
      ) : (
        <div>
          <p>Connected: {walletAddress.substring(0, 8)}...</p>
          <button onClick={() => setShowInventory(true)}>
            View NFT Inventory
          </button>
        </div>
      )}

      <StarterModal
        isOpen={showStarterModal}
        onClose={() => setShowStarterModal(false)}
        onStarterChosen={(starter, nft) => {
          console.log('Starter chosen:', starter, nft);
        }}
      />

      <NFTInventory
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
      />
    </div>
  );
}
```

### 10. Test the Flow

#### Start Backend Server

```bash
cd backend
npm run dev
# or
node server.js
```

#### Start Frontend

```bash
cd frontend
npm run dev
```

#### Test Sequence

1. **Connect Wallet**: Click "Connect Pera Wallet" or "Connect Defly Wallet"
2. **Choose Starter**: Select Charmander, Squirtle, or Bulbasaur → NFT minted!
3. **Play Game**: Walk around and encounter wild Pokémon
4. **Catch Pokémon**: Successfully catch one → NFT automatically minted
5. **View Inventory**: Check your NFT collection with on-chain proof

## 🔍 Verification

### Check NFT on Blockchain

After minting, you can verify the NFT on AlgoExplorer:

```
https://testnet.algoexplorer.io/asset/{ASSET_ID}
```

### Check Transaction

```
https://testnet.algoexplorer.io/tx/{TX_ID}
```

## 🐛 Troubleshooting

### "Admin account not configured"

**Solution**: Make sure `ADMIN_MNEMONIC` is set in your `.env` file.

### "NFT contract not deployed"

**Solution**: Deploy the contract and set `NFT_CONTRACT_ID` in `.env`.

### "Insufficient balance"

**Solution**: Fund your admin account with TestNet ALGO from the dispenser.

### "Failed to mint NFT"

**Possible causes**:
- Backend not running
- Contract not deployed
- Admin account has no ALGO
- Wallet not connected

**Check logs**: Look at backend console for detailed error messages.

### Database Errors

**Solution**: Make sure PostgreSQL is running and database schema is up to date:

```bash
npx prisma db push
npx prisma generate
```

## 🎨 Customization

### Change Starter Pokémon

Edit `backend/routes/nft.js`:

```javascript
const starterMap = {
  'pikachu': 25,
  'eevee': 133,
  'charmander': 4,
  // Add more...
};
```

### Adjust Rarity Thresholds

Edit `backend/controllers/nftController.js`:

```javascript
function determineRarity(pokemonData) {
  const totalStats = pokemonData.stats
    ?.reduce((sum, stat) => sum + stat.base_stat, 0) || 0;

  if (totalStats > 650) return 'Mythical';  // Adjust these
  if (totalStats > 600) return 'Legendary';
  if (totalStats > 500) return 'Rare';
  if (totalStats > 400) return 'Uncommon';
  return 'Common';
}
```

### Add More Legendary IDs

Edit `frontend/lib/phaser/BattleScene.ts`:

```typescript
private checkIfLegendary(pokeId: number): boolean {
  const legendaryIds = [
    150, // Mewtwo
    // Add more legendary IDs...
  ];
  return legendaryIds.includes(pokeId);
}
```

## 📊 Database Schema

The database tracks all minted NFTs:

```prisma
model PlayerProgress {
  walletAddress  String?  @unique
  starterChosen  Boolean  @default(false)
  starterPokemon String?
  caughtNFTs     CaughtNFT[]
}

model CaughtNFT {
  assetId       BigInt   @unique
  pokemonName   String
  pokeId        Int
  rarity        String
  level         Int
  isLegendary   Boolean
  txHash        String
  caughtAt      DateTime @default(now())
  metadata      Json
}
```

## 🔐 Security Notes

1. **Never commit** your `ADMIN_MNEMONIC` to version control
2. **Use environment variables** for all sensitive data
3. **For production**: Use a proper key management system (AWS KMS, HashiCorp Vault)
4. **Rate limiting**: Add rate limits to prevent abuse
5. **Validation**: Always validate wallet addresses and user inputs

## 🚀 Production Deployment

When ready for production:

1. Change `NETWORK=mainnet` in `.env`
2. Deploy contracts to MainNet (requires real ALGO)
3. Update `ALGOD_SERVER` to MainNet node
4. Test thoroughly on TestNet first!
5. Consider using a dedicated node for better performance

## 📚 Resources

- [Algorand Developer Portal](https://developer.algorand.org/)
- [AlgoKit Documentation](https://github.com/algorandfoundation/algokit-cli)
- [Pera Wallet](https://perawallet.app/)
- [AlgoExplorer TestNet](https://testnet.algoexplorer.io/)

## 🎉 Success!

Your players can now:
- ✅ Connect Algorand wallets (Pera, Defly, MyAlgo)
- ✅ Mint starter Pokémon as NFTs
- ✅ Catch wild Pokémon → auto-mint as NFTs
- ✅ View NFT inventory with on-chain proof
- ✅ Verify ownership on AlgoExplorer

Welcome to Web3 Pokémon! 🔥
