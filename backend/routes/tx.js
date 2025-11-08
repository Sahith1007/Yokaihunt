import express from 'express';
import TxLog from '../models/TxLog.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

// In-memory fallback
const mem = new Map();

router.post('/tx/log', async (req, res) => {
  try {
    const { walletAddress, txId, type = 'CAPTURE', asset = 'Yokai', meta } = req.body || {};
    if (!walletAddress || !txId) return res.status(400).json({ error: 'walletAddress and txId required' });
    if (isMongoConnected()) {
      await TxLog.create({ walletAddress, txId, type, asset, meta });
    } else {
      const list = mem.get(walletAddress) || [];
      list.unshift({ walletAddress, txId, type, asset, meta, timestamp: new Date() });
      mem.set(walletAddress, list.slice(0, 20));
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to log tx' });
  }
});

router.get('/tx/log', async (req, res) => {
  try {
    const walletAddress = (req.query.walletAddress || '').toString();
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    if (isMongoConnected()) {
      const list = await TxLog.find({ walletAddress }).sort({ timestamp: -1 }).limit(20).lean();
      return res.json({ logs: list });
    } else {
      return res.json({ logs: (mem.get(walletAddress) || []) });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
