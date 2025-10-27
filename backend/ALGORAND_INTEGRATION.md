# Algorand NFT Integration - Backend

Backend services for integrating Yokai Hunt with Algorand smart contracts.

## 📦 Installation

```bash
cd backend
npm install algosdk
```

## ⚙️ Setup

1. **Copy environment template**:
   ```bash
   cat .env.algorand.example >> .env
   ```

2. **Create an Algorand account** for your backend:
   ```bash
   # Install algokey
   pip install py-algorand-sdk
   
   # Generate account
   python -c "from algosdk import account, mnemonic; private_key, address = account.generate_account(); print(f'Address: {address}'); print(f'Mnemonic: {mnemonic.from_private_key(private_key)}')"
   ```

3. **Fund your account** with TestNet ALGO:
   - Visit: https://bank.testnet.algorand.network/
   - Paste your address
   - Request 10+ ALGO

4. **Deploy contracts** (see `../contracts/scripts/deploy.py`)

5. **Update `.env`** with:
   - Your `ADMIN_MNEMONIC`
   - Contract IDs from deployment

## 🚀 Usage

### API Endpoints

#### Mint NFT After Catch
```http
POST /api/nft/mint
Content-Type: application/json

{
  "pokemonData": {
    "name": "Pikachu",
    "pokeId": 25,
    "level": 5,
    "stats": [...],
    "types": [...]
  },
  "playerAddress": "ALGORAND_ADDRESS_HERE"
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully minted Pikachu as NFT!",
  "nft": {
    "assetId": 123456,
    "txId": "ABC123...",
    "name": "Pikachu",
    "rarity": "Rare",
    "isLegendary": false,
    "explorerUrl": "https://testnet.algoexplorer.io/tx/..."
  }
}
```

#### Get Player's NFTs
```http
GET /api/nft/player/ALGORAND_ADDRESS
```

#### Evolve Yokai
```http
POST /api/nft/evolve
Content-Type: application/json

{
  "playerAddress": "ALGO_ADDRESS",
  "burnAssets": [123, 456],
  "targetStage": 1
}
```

### Integration with Existing Routes

Update your Pokemon controller to mint NFT after successful catch:

```javascript
// In pokemonController.js
const algorandService = require('../services/algorandService');

exports.catchPokemon = async (req, res) => {
  // ... existing catch logic ...
  
  // After successful catch, mint NFT if player has wallet connected
  if (req.body.playerAddress) {
    try {
      const nftResult = await algorandService.mintYokaiNFT(
        caughtPokemon,
        req.body.playerAddress
      );
      
      // Add NFT info to response
      response.nft = {
        assetId: nftResult.assetId,
        txId: nftResult.txId
      };
    } catch (error) {
      console.error('NFT minting failed:', error);
      // Don't fail the catch if NFT minting fails
    }
  }
  
  res.json(response);
};
```

## 🔒 Security

- ✅ Admin mnemonic stored in environment variables
- ✅ Never expose private keys to frontend
- ✅ Backend signs all minting/evolution transactions
- ✅ Player addresses validated before operations
- ✅ Ownership verification before evolution

## 🧪 Testing

Test minting locally:
```bash
curl -X POST http://localhost:4000/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonData": {
      "name": "Pikachu",
      "pokeId": 25,
      "level": 5,
      "stats": [{"stat": {"name": "hp"}, "base_stat": 35}]
    },
    "playerAddress": "YOUR_TESTNET_ADDRESS"
  }'
```

## 📊 Flow Diagram

```
Player catches Pokemon
       ↓
Frontend sends catch + wallet address
       ↓
Backend validates catch
       ↓
Backend calls algorandService.mintYokaiNFT()
       ↓
Smart contract mints NFT
       ↓
NFT transferred to player's wallet
       ↓
Response with asset ID + transaction ID
```

## 🐛 Troubleshooting

**Error: "Admin account not configured"**
- Check that `ADMIN_MNEMONIC` is set in .env
- Verify it's a valid 25-word phrase

**Error: "NFT contract not deployed"**
- Run deployment script first
- Update `NFT_CONTRACT_ID` in .env

**Error: "Transaction pool error"**
- Check admin account has enough ALGO (need ~0.1 per mint)
- Verify network connectivity to algod node

## 🔗 Resources

- [Algorand Developer Docs](https://developer.algorand.org/)
- [algosdk-js Documentation](https://algorand.github.io/js-algorand-sdk/)
- [TestNet Explorer](https://testnet.algoexplorer.io/)
- [TestNet Faucet](https://bank.testnet.algorand.network/)
