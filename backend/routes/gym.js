import express from "express";
import GymProgress from "../models/GymProgress.js";
import { loadGyms, buildBattlePayload, getAllGymIds } from "../services/gymService.js";

const router = express.Router();

// Wallet header guard (same style as trainer routes)
function wallet(req) {
  return (req.headers["x-wallet-address"] || req.body?.wallet || req.query?.wallet || "").toString();
}

// GET /api/gym/list
router.get("/gym/list", (_req, res) => {
  const { gyms } = loadGyms();
  // Do not include user progress
  res.json({ ok: true, gyms });
});

// GET /api/gym/progress?wallet=...
router.get("/gym/progress", async (req, res) => {
  try {
    const w = wallet(req);
    if (!w) return res.status(401).json({ ok: false, error: "wallet required" });
    const ids = getAllGymIds();
    let doc = await GymProgress.findOne({ wallet: w });
    if (!doc) doc = await GymProgress.create({ wallet: w, gyms: Object.fromEntries(ids.map((id) => [id, false])) });
    // backfill missing keys
    let changed = false;
    ids.forEach((id) => { if (!doc.gyms.has(id)) { doc.gyms.set(id, false); changed = true; } });
    if (changed) await doc.save();
    res.json({ ok: true, progress: Object.fromEntries(doc.gyms) });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed" });
  }
});

// POST /api/gym/start { wallet, gymId }
router.post("/gym/start", async (req, res) => {
  try {
    const w = wallet(req);
    const { gymId } = req.body || {};
    if (!w || !gymId) return res.status(400).json({ ok: false, error: "wallet and gymId required" });
    const payload = await buildBattlePayload(gymId);
    res.json({ ok: true, battle: payload });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || "start failed" });
  }
});

// POST /api/gym/win { wallet, gymId }
router.post("/gym/win", async (req, res) => {
  try {
    const w = wallet(req);
    const { gymId } = req.body || {};
    if (!w || !gymId) return res.status(400).json({ ok: false, error: "wallet and gymId required" });
    const ids = getAllGymIds();
    if (!ids.includes(gymId)) return res.status(404).json({ ok: false, error: "gym not found" });
    let doc = await GymProgress.findOne({ wallet: w });
    if (!doc) doc = await GymProgress.create({ wallet: w, gyms: {} });
    if (!doc.gyms.get(gymId)) doc.gyms.set(gymId, true);
    await doc.save();

    // reward XP (read from data)
    const g = loadGyms().byId.get(gymId);
    const rewardXP = g?.rewardXP || 600;

    // Minimal badge object
    const badge = { badgeId: g?.badgeId || gymId, name: `${g?.name} Badge`, description: `Awarded for defeating ${g?.name} (${g?.region}).` };

    res.json({ ok: true, gymId, awarded: { xp: rewardXP }, badge });
  } catch (e) {
    res.status(500).json({ ok: false, error: "win failed" });
  }
});

export default router;
