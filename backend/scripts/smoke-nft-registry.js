import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nftRegistryRoutes from '../routes/nftRegistry.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req,res)=>res.json({ ok:true }));

// Minimal wallet header check similar to main server
app.use('/api', (req,res,next)=>{
  if (req.method === 'OPTIONS') return next();
  const addr = (req.headers['x-wallet-address']||'').toString();
  if (!addr) return res.status(401).json({ error:'walletAddress header (x-wallet-address) required' });
  next();
});

app.use('/api', nftRegistryRoutes);

const PORT = process.env.SMOKE_PORT || 4100;
const server = app.listen(PORT, ()=>console.log('SMOKE server listening on', PORT));

// Close the server after a short delay, as this is a smoke test script.
// This prevents the 'address already in use' error on subsequent runs.
setTimeout(() => {
  server.close(() => {
    console.log('SMOKE server closed.');
    process.exit(0);
  });
}, 5000); // Close after 5 seconds
