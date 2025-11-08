import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import "./db.js";
import pokemonRoutes from "./routes/pokemon.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "YokaiHunt Backend is running!", uptime: process.uptime() });
});

// Wallet header validation for all API routes
app.use("/api", (req, res, next) => {
  // Allow preflight
  if (req.method === 'OPTIONS') return next();
  const addr = (req.headers['x-wallet-address'] || req.headers['x-wallet'] || req.body?.walletAddress || req.query?.walletAddress || '').toString();
  if (!addr) return res.status(401).json({ error: 'walletAddress header (x-wallet-address) required' });
  next();
});

// Routes
app.use("/api", pokemonRoutes);
import trainerRoutes from "./routes/trainer.js";
app.use("/api", trainerRoutes);
import nftRoutes from "./routes/nft2.js";
app.use("/api", nftRoutes);
import battleRoutes from "./routes/battle.js";
app.use("/api", battleRoutes);
import spawnRoutes from "./routes/spawn.js";
app.use("/api", spawnRoutes);
import txRoutes from "./routes/tx.js";
app.use("/api", txRoutes);
import captureRoutes from "./routes/capture.js";
app.use("/api", captureRoutes);
import playerRoutes from "./routes/player.js";
app.use("/api", playerRoutes);
import pokemonRoutes from "./routes/pokemon.js";
app.use("/api", pokemonRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server wrapper
const server = http.createServer(app);

// Initialize Socket.io
try {
  const initSocket = (await import('./socket/index.js')).default;
  initSocket(server);
  console.log('🔌 Socket.io initialized');
} catch (e) {
  console.warn('Socket.io not initialized:', e?.message || e);
}

// Start server
server.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 API endpoints: http://localhost:${PORT}/api`);

  // Schedule daily backups to IPFS for all active trainers
  (async () => {
    try {
      const cron = await import('node-cron');
      const fetchMod = await import('node-fetch');
      const fetchFn = (fetchMod.default || fetchMod);
      const base = `http://localhost:${PORT}/api/trainer/backup`;

      // Every 24 hours at 03:00 server time
      cron.schedule('0 3 * * *', async () => {
        try {
          console.log('⏰ Running daily IPFS backup job...');
          const { default: Trainer } = await import('./models/Trainer.js');
          const list = await Trainer.find({}, 'walletAddress').lean();
          for (const t of list) {
            const wallet = t.walletAddress;
            if (!wallet) continue;
            try {
              const resp = await fetchFn(base, {
                method: 'POST',
                headers: { 'x-wallet-address': wallet, 'content-type': 'application/json' },
                body: JSON.stringify({ walletAddress: wallet })
              });
              const js = await resp.json().catch(() => ({}));
              console.log('  → Backup attempt', wallet, resp.status, js?.cid || js?.ipfsHash || '');
            } catch (err) {
              console.warn('  → Backup error for', wallet, err?.message || err);
            }
          }
          console.log('✅ Daily IPFS backup job finished');
        } catch (err) {
          console.warn('Daily backup job failed to run:', err?.message || err);
        }
      });
    } catch (err) {
      console.warn('node-cron not available; skipping scheduled backups');
    }
  })();
});
