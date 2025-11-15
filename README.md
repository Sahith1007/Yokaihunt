# 🎮 Yokai Hunt – Full Deployment Guide
**End-to-end setup for deploying the Yokai Hunt Pokémon-style NFT game on Algorand.**

Yokai Hunt is a blockchain-powered monster-catching game where players catch, mint, trade, evolve, and stake Pokémon-style NFTs on the Algorand blockchain.

## ✅ Features

### **Core Game Mechanics**

* Catch Pokémon → Mint automatically as Algorand NFTs
* Enforced **1/1 Legendary system** (e.g., only ONE Mewtwo can ever exist)
* Marketplace for buying/selling NFTs
* Evolution via burning 2–4 NFTs
* Yield farming with evolved Yokai

### **Full Stack**

* **Smart Contracts:** Minting, marketplace, evolution, staking
* **Backend:** Node.js API + Algorand transaction signing
* **Frontend:** Next.js + Phaser + Pera/Defly Wallet support

# 🚀 Quick Deployment (5 Steps)

### **1️⃣ Install Dependencies**

```bash
# Smart contracts
pip install algorand-python py-algorand-sdk

# Backend
cd backend
npm install algosdk

# Frontend
cd ../frontend
npm install
```

### **2️⃣ Create Algorand Account**

```bash
python -c "from algosdk import account, mnemonic; pk, addr = account.generate_account(); print(f'Address: {addr}\nMnemonic: {mnemonic.from_private_key(pk)}')"
```

Save the mnemonic—this will be your deployer/admin wallet.

### **3️⃣ Fund Your TestNet Account**

Use the faucet to get free 20 ALGO:
**TestNet Faucet:** [https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/)

### **4️⃣ Deploy Smart Contracts**

```bash
cd contracts

# Compile
algokit compile python yokai_nft.py
algokit compile python yokai_marketplace.py
algokit compile python yokai_evolution.py
algokit compile python yokai_yield.py

# Deploy
cd scripts
python deploy.py --network testnet
```

Save all application IDs printed by the script.

### **5️⃣ Configure Backend**

```bash
cd backend
cat .env.algorand.example >> .env
```

Edit `.env`:

```
ADMIN_MNEMONIC="your mnemonic"
NFT_CONTRACT_ID=xxxx
MARKETPLACE_CONTRACT_ID=xxxx
EVOLUTION_CONTRACT_ID=xxxx
YIELD_CONTRACT_ID=xxxx
ALGOD_SERVER=https://testnet-api.algonode.cloud
```

Run server:

```bash
npm run dev:server
```

# 📁 Project Structure

```
yokaihunt/
├── contracts/
│   ├── yokai_nft.py
│   ├── yokai_marketplace.py
│   ├── yokai_evolution.py
│   ├── yokai_yield.py
│   ├── metadata/
│   └── scripts/deploy.py
│
├── backend/
│   ├── services/algorandService.js
│   ├── controllers/nftController.js
│   └── ALGORAND_INTEGRATION.md
│
└── frontend/
    ├── components/
    │   ├── WalletButton.tsx
    │   └── Game.tsx
    └── lib/wallet.ts
```

# 🧩 Phase-by-Phase Deployment

## **Phase 1 – Smart Contracts**

1. Compile using AlgoKit
2. Deploy using `deploy.py`
3. Store the output App IDs

Typical output:

```
NFT Contract: 123456
Marketplace: 123457
Evolution: 123458
Yield: 123459
```

## **Phase 2 – Backend**

* Uses `algosdk` to sign and send all blockchain transactions
* Exposes:

  * `POST /api/nft/mint`
  * `GET /api/nft/player/:address`
  * `POST /api/nft/evolve`

Test minting:

```bash
curl -X POST http://localhost:4000/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{"pokemonData": {...}, "playerAddress": "YOUR_ADDRESS"}'
```

## **Phase 3 – Frontend Integration**

Mint NFT on catch:

```ts
const response = await fetch('/api/nft/mint', {
  method: 'POST',
  body: JSON.stringify({
    pokemonData: caughtPokemon,
    playerAddress: walletAddress
  })
});
```

Fetch player NFTs:

```
/api/nft/player/{wallet}
```

## **Phase 4 – Testing Checklist**

### **Smart Contracts**

* Mint common NFT
* Mint legendary → should succeed ONCE
* Second legendary mint → fails
* List NFT on marketplace
* Buy NFT
* Evolve (burn + mint evolved Yokai)

### **Backend**

* Server boots
* Mint, evolve, fetch endpoints work
* Ownership checks pass

### **Frontend**

* Wallet connects
* Catch → NFT mint
* Marketplace UI loads
* Inventory shows owned NFTs

# 🔐 Security Checklist

* Admin mnemonic stored only in `.env`
* Backend signs all transactions on server
* Legendary constraint enforced on-chain
* Ownership verified before evolution/trade
* `.env` in `.gitignore`

# 🐛 Common Issues & Fixes

| Issue                          | Fix                                          |
| ------------------------------ | -------------------------------------------- |
| “Admin account not configured” | Add `ADMIN_MNEMONIC` to `.env`               |
| “Contract not deployed”        | Deploy contracts and update IDs              |
| Insufficient balance           | Add more ALGO from faucet                    |
| NFT doesn’t appear in wallet   | Asset opt-in handled by contract; retry mint |

# 🎉 Next Steps

* Add battle rewards
* Add staking dashboard
* Add trading UI
* MainNet deployment
* Marketing: Twitter, Reddit, Algorand Discord

# 📚 Useful Links

* Algorand Docs: [https://developer.algorand.org/](https://developer.algorand.org/)
* TestNet Explorer: [https://testnet.algoexplorer.io/](https://testnet.algoexplorer.io/)
* Faucet: [https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/)
* JS SDK Docs: [https://algorand.github.io/js-algorand-sdk/](https://algorand.github.io/js-algorand-sdk/)
* Algorand Discord: [https://discord.gg/algorand](https://discord.gg/algorand)
# Testnet Contract deployment link:
https://lora.algokit.io/testnet/asset/749671836

