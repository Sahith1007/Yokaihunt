# NFT Metadata Registry

This service mints and manages Algorand ASAs for YokaiHunt items (pokemon, badges, items), pins JSON metadata to IPFS (Pinata), and tracks a history log for every asset.

## Endpoints

Base path: /api

- POST /nft/registry/mint
  - Headers: x-wallet-address: <OWNER_WALLET>
  - Body: { uid: string, type: "pokemon"|"badge"|"item", metadata: object, mode?: "live"|"frozen" }
  - Response: { ok, assetId, txId, metadataCid, record }

- POST /nft/registry/refresh
  - Headers: x-wallet-address: <OWNER_WALLET>
  - Body: { assetId: number, newMetadata: object }
  - Rate limit: once every 30s per asset
  - Response: { ok, configTxId, newCid, record }

- GET /nft/registry/:assetId
  - Headers: x-wallet-address: <ANY>
  - Response: { ok, record, metadataUrl }

- POST /nft/registry/recover
  - Headers: x-wallet-address: <OWNER_WALLET>
  - Body: { assetId: number }
  - Response: { ok, record }

## Metadata Schema

Minimal required fields:
- name: string
- description: string
- image: string (ipfs:// or https URL)
- attributes: array of { trait_type, value }

Example (pokemon):
```
{
  "name": "Pikachu #abc123",
  "description": "Level 12 Pikachu owned by ALGO...",
  "image": "ipfs://<cid>",
  "attributes": [
    { "trait_type": "Level", "value": 12 },
    { "trait_type": "XP", "value": 3450 },
    { "trait_type": "Moves", "value": "Thunderbolt, Quick Attack" }
  ]
}
```

Example (badge):
```
{
  "name": "Boulder Badge",
  "description": "Awarded for defeating Pewter Gym",
  "image": "ipfs://<cid>",
  "attributes": [ { "trait_type": "Region", "value": "Kanto" } ]
}
```

Size limit: <= 40KB JSON after stringification.

## History Tracking

Each record persists a history array with entries: { ts, action: "mint"|"refresh"|"recover", cid, txId?, by, note? }.

## Curl Examples

Mint:
```
curl -X POST http://localhost:4000/api/nft/registry/mint \
  -H "content-type: application/json" \
  -H "x-wallet-address: {{OWNER_WALLET}}" \
  -d '{
    "uid": "abc123",
    "type": "pokemon",
    "mode": "live",
    "metadata": {"name":"Pikachu #abc123","description":"L12 Pikachu","image":"ipfs://...","attributes":[{"trait_type":"Level","value":12}]}
  }'
```

Refresh:
```
curl -X POST http://localhost:4000/api/nft/registry/refresh \
  -H "content-type: application/json" \
  -H "x-wallet-address: {{OWNER_WALLET}}" \
  -d '{
    "assetId": 12345,
    "newMetadata": {"name":"Pikachu #abc123","description":"L13 Pikachu","image":"ipfs://...","attributes":[{"trait_type":"Level","value":13}]}
  }'
```

Recover:
```
curl -X POST http://localhost:4000/api/nft/registry/recover \
  -H "content-type: application/json" \
  -H "x-wallet-address: {{OWNER_WALLET}}" \
  -d '{"assetId":12345}'
```

Get record:
```
curl -H "x-wallet-address: {{ANY_WALLET}}" http://localhost:4000/api/nft/registry/12345
```
