# 🎮 Yokai Hunt - Complete Deployment Guide

End-to-end guide for deploying your Pokemon NFT game on Algorand.

## 📋 What You've Built

A complete blockchain-powered Pokemon game with:
- **Smart Contracts**: NFT minting, marketplace, evolution, yield staking
- **Backend Integration**: Node.js API for minting NFTs
- **Frontend**: Next.js game with Algorand wallet support
- **Features**:
  - ✅ Catch Pokemon → Mint as NFTs
  - ✅ 1/1 Legendary enforcement (only ONE Mewtwo can exist!)
  - ✅ Marketplace for trading
  - ✅ Evolution system (burn 2-4 NFTs to evolve)
  - ✅ Yield farming with evolved NFTs

---

## 🚀 Quick Start (5 Steps)

### 1️⃣ Install Dependencies

```bash
# Smart contracts
pip install algorand-python py-algorand-sdk

# Backend
cd backend
npm install algosdk

# Frontend (already done)
cd ../frontend
npm install
```

### 2️⃣ Create Algorand Account

```bash
python -c "from algosdk import account, mnemonic; pk, addr = account.generate_account(); print(f'Address: {addr}\nMnemonic: {mnemonic.from_private_key(pk)}')"
```

**Save this mnemonic!** You'll need it for deployment.

### 3️⃣ Fund Your Account

Visit https://bank.testnet.algorand.network/ and get 20 ALGO (free for TestNet)

### 4️⃣ Deploy Smart Contracts

```bash
cd contracts

# Compile contracts (requires Algorand Python / AlgoKit)
algokit compile python yokai_nft.py
algokit compile python yokai_marketplace.py
algokit compile python yokai_evolution.py
algokit compile python yokai_yield.py

# Deploy
cd scripts
python deploy.py --network testnet
```

Save the contract IDs from output!

### 5️⃣ Configure Backend

```bash
cd ../../backend

# Copy environment template
cat .env.algorand.example >> .env

# Edit .env and add:
# - Your ADMIN_MNEMONIC (from step 2)
# - Contract IDs (from step 4)

# Start server
npm run dev:server
```

---

## 📁 Project Structure

```
yokaihunt/
├── contracts/                    # Smart contracts
│   ├── yokai_nft.py             # NFT minting contract
│   ├── yokai_marketplace.py     # Trading marketplace
│   ├── yokai_evolution.py       # Evolution system
│   ├── yokai_yield.py           # Yield farming
│   ├── metadata/                # NFT schemas
│   └── scripts/
│       └── deploy.py            # Deployment script
│
├── backend/                      # Node.js API
│   ├── services/
│   │   └── algorandService.js   # Algorand integration
│   ├── controllers/
│   │   └── nftController.js     # NFT endpoints
│   └── ALGORAND_INTEGRATION.md  # Backend docs
│
└── frontend/                     # Next.js game
    ├── components/
    │   ├── WalletButton.tsx     # Connect wallet
    │   └── Game.tsx             # Phaser game
    └── lib/
        └── wallet.ts            # Wallet manager
```

---

## 🎯 Full Deployment Steps

### Phase 1: Smart Contracts

1. **Compile all contracts**:
   ```bash
   cd contracts
   algokit compile python yokai_nft.py
   # Repeat for other contracts
   ```

2. **Review compiled TEAL**:
   Check `contracts/artifacts/` for approval and clear programs

3. **Deploy to TestNet**:
   ```bash
   cd scripts
   export DEPLOYER_MNEMONIC="your 25 words here"
   python deploy.py --network testnet
   ```

4. **Save deployment info**:
   Note the application IDs from output:
   - NFT Contract: `123456`
   - Marketplace: `123457`
   - Evolution: `123458`
   - Yield: `123459`

### Phase 2: Backend Setup

1. **Install Algorand SDK**:
   ```bash
   cd backend
   npm install algosdk
   ```

2. **Configure environment**:
   ```bash
   # .env
   ADMIN_MNEMONIC="your mnemonic"
   NFT_CONTRACT_ID=123456
   MARKETPLACE_CONTRACT_ID=123457
   EVOLUTION_CONTRACT_ID=123458
   YIELD_CONTRACT_ID=123459
   ALGOD_SERVER=https://testnet-api.algonode.cloud
   ```

3. **Add NFT routes** to your Express app:
   ```javascript
   // In index.js or routes
   const nftController = require('./controllers/nftController');
   
   app.post('/api/nft/mint', nftController.mintYokaiNFT);
   app.get('/api/nft/player/:address', nftController.getPlayerNFTs);
   app.post('/api/nft/evolve', nftController.evolveYokai);
   ```

4. **Test minting**:
   ```bash
   curl -X POST http://localhost:4000/api/nft/mint \
     -H "Content-Type: application/json" \
     -d '{"pokemonData": {...}, "playerAddress": "YOUR_ALGO_ADDRESS"}'
   ```

### Phase 3: Frontend Integration

1. **Wallet is already set up** via @txnlab/use-wallet ✅

2. **Update catch logic** to mint NFTs:
   ```typescript
   // In your catch handler
   if (walletAddress) {
     const response = await fetch('/api/nft/mint', {
       method: 'POST',
       body: JSON.stringify({
         pokemonData: caughtPokemon,
         playerAddress: walletAddress
       })
     });
     
     const { nft } = await response.json();
     console.log('Minted NFT:', nft.assetId);
   }
   ```

3. **Display NFTs** in player inventory (optional):
   Fetch from `/api/nft/player/{address}` and show in UI

### Phase 4: Testing

1. **Test wallet connection**: Connect Pera/Defly wallet
2. **Test Pokemon catch**: Catch a Pokemon
3. **Verify NFT minted**: Check TestNet explorer
4. **Test evolution**: Burn 2 NFTs to evolve
5. **Test marketplace**: List and buy NFTs

---

## 🔐 Security Checklist

- ✅ Admin mnemonic in `.env` (never commit!)
- ✅ Backend signs all transactions (players can't forge)
- ✅ Legendary constraint enforced on-chain
- ✅ Ownership verified before evolution/trading
- ✅ `.env` in `.gitignore`

---

## 🧪 Testing Checklist

### Smart Contracts
- [ ] Deploy to TestNet successfully
- [ ] Mint a common Pokemon NFT
- [ ] Try minting Mewtwo (should succeed once)
- [ ] Try minting Mewtwo again (should fail - 1/1 enforced!)
- [ ] List NFT on marketplace
- [ ] Buy listed NFT
- [ ] Evolve Pokemon (burn 2, get evolved)

### Backend
- [ ] Server starts without errors
- [ ] `/api/nft/mint` endpoint works
- [ ] `/api/nft/player/:address` returns NFTs
- [ ] Evolution endpoint verifies ownership

### Frontend
- [ ] Wallet connects (Pera/Defly)
- [ ] Game loads with starter Pokemon
- [ ] Catch Pokemon triggers NFT mint
- [ ] Marketplace page displays
- [ ] Inventory shows caught NFTs

---

## 🐛 Common Issues

### "Admin account not configured"
**Solution**: Add `ADMIN_MNEMONIC` to backend `.env`

### "NFT contract not deployed"
**Solution**: Deploy contracts first, update `NFT_CONTRACT_ID`

### "Insufficient balance"
**Solution**: Fund admin account with more ALGO from faucet

### Contract deployment fails
**Solution**: 
1. Check you have 15+ ALGO
2. Verify algod connection
3. Try again with `--network testnet`

### NFT not appearing in wallet
**Solution**: Player must opt-in to asset first (done automatically by contract)

---

## 📊 Costs (TestNet is FREE)

MainNet costs (if you deploy to production):
- Deploy contracts: ~5 ALGO (~$2)
- Mint NFT: ~0.001 ALGO per mint
- Box storage: ~0.1 ALGO per 1KB of metadata
- Marketplace fee: 2% of sale price (customizable)

---

## 🎉 Success! What Next?

Once everything works on TestNet:

1. **Add more features**:
   - Trading UI in marketplace
   - Staking dashboard for yield
   - Battle rewards in NFTs

2. **Deploy to MainNet**:
   - Change `ALGOD_SERVER` to mainnet node
   - Re-deploy contracts
   - Update contract IDs

3. **Launch**:
   - Market your game!
   - Promote on /r/AlgorandOfficial
   - Share on Twitter with #Algorand

---

## 📚 Resources

- **Algorand Docs**: https://developer.algorand.org/
- **TestNet Explorer**: https://testnet.algoexplorer.io/
- **Faucet**: https://bank.testnet.algorand.network/
- **algosdk Docs**: https://algorand.github.io/js-algorand-sdk/
- **Algorand Discord**: https://discord.gg/algorand

---

## 🤝 Support

Need help? Check:
1. `contracts/README.md` - Smart contract docs
2. `backend/ALGORAND_INTEGRATION.md` - Backend integration
3. Contract comments - Inline documentation
4. Algorand Discord - Community support

---

**Built with ❤️ on Algorand**

Good luck with your Yokai Hunt launch! 🎮🔗
