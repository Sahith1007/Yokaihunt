import express from 'express';
import { mintAsset, refreshAsset, getRecord, recoverAsset } from '../services/metadataRegistry.js';

const router = express.Router();

// Simple in-memory per-asset rate limiter for refresh
const lastRefresh = new Map(); // assetId -> ms
const REFRESH_INTERVAL_MS = 30_000;

function wallet(req) {
  return (
    req.headers['x-wallet-address'] ||
    req.headers['x-wallet'] ||
    req.body?.ownerWallet ||
    req.body?.walletAddress ||
    req.query?.walletAddress ||
    ''
  ).toString();
}

router.post('/nft/registry/mint', async (req, res) => {
  try {
    const ownerWallet = wallet(req);
    const { uid, type, metadata, mode } = req.body || {};
    if (!uid || !type || !metadata) return res.status(400).json({ ok: false, error: 'uid, type, metadata required' });
    const r = await mintAsset({ uid, type, ownerWallet, metadata, mode });
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'mint failed' });
  }
});

router.post('/nft/registry/refresh', async (req, res) => {
  try {
    const ownerWallet = wallet(req);
    const { assetId, newMetadata } = req.body || {};
    if (!assetId || !newMetadata) return res.status(400).json({ ok: false, error: 'assetId, newMetadata required' });
    const now = Date.now();
    const last = lastRefresh.get(Number(assetId)) || 0;
    if (now - last < REFRESH_INTERVAL_MS) {
      const waitMs = REFRESH_INTERVAL_MS - (now - last);
      return res.status(429).json({ ok: false, error: 'rate_limited', retryInMs: waitMs });
    }
    const r = await refreshAsset({ assetId: Number(assetId), ownerWallet, newMetadata });
    lastRefresh.set(Number(assetId), now);
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'refresh failed' });
  }
});

router.get('/nft/registry/:assetId', async (req, res) => {
  try {
    const assetId = Number(req.params.assetId);
    const rec = await getRecord(assetId);
    if (!rec) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, record: rec, metadataUrl: rec.currentCid ? `ipfs://${rec.currentCid}` : null });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'failed' });
  }
});

router.post('/nft/registry/recover', async (req, res) => {
  try {
    const ownerWallet = wallet(req);
    const { assetId } = req.body || {};
    if (!assetId) return res.status(400).json({ ok: false, error: 'assetId required' });
    const rec = await recoverAsset({ ownerWallet, assetId: Number(assetId) });
    res.json({ ok: true, record: rec });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'recover failed' });
  }
});

export default router;
