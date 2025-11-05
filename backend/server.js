import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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

// Start server
app.listen(PORT, () => {
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
