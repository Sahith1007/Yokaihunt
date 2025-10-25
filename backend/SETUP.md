# 🚀 YokaiHunt Backend Setup

## MongoDB Atlas Setup (Required)

### 1. Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for free account
3. Create a new cluster (Free tier is fine)

### 2. Get Connection String
1. In Atlas dashboard, click "Connect"
2. Choose "Connect your application"
3. Copy the connection string
4. Replace `<password>` with your database password
5. Replace `<dbname>` with `yokaihunt`

### 3. Update Environment Variables
Update your `.env` file:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/yokaihunt?retryWrites=true&w=majority
```

### 4. Configure Network Access
1. In Atlas, go to "Network Access"
2. Add IP Address: `0.0.0.0/0` (for development)
3. Or add your specific IP address

## 🧪 Testing

### Start Server
```bash
npm run dev
```

### Test Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Spawn Pokemon (works without MongoDB)
curl http://localhost:3001/api/spawn

# Create player (requires MongoDB)
curl -X POST http://localhost:3001/api/player \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","walletAddress":"0x123"}'
```

## 📋 Available Endpoints

### No Database Required
- `GET /health` - Health check
- `GET /api/spawn` - Get random Pokemon data

### Database Required  
- `POST /api/player` - Create player
- `GET /api/player/:id` - Get player
- `POST /api/catch` - Catch Pokemon
- `GET /api/inventory/:playerId` - View inventory
- `POST /api/evolve` - Evolve Pokemon
- `POST /api/sell` - List for sale
- `GET /api/marketplace` - Browse marketplace
- `POST /api/buy` - Purchase Pokemon

## 🔧 Alternative: Local MongoDB

If you prefer local development:

1. Install MongoDB Community Edition
2. Start MongoDB service
3. Update `.env`: `MONGO_URI=mongodb://localhost:27017/yokaihunt`