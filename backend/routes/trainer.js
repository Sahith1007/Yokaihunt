import express from "express";
import Trainer from "../models/Trainer.js";
import { isMongoConnected } from "../db.js";

// Very lightweight wallet session verification
function verifyWalletSession(req, res, next) {
  const hdr = (req.headers["x-wallet-address"] || req.headers["x-wallet"] || "").toString();
  const bodyAddr = (req.body?.walletAddress || req.params?.walletAddress || "").toString();
  if (!hdr && !bodyAddr) return res.status(401).json({ error: "Missing wallet session" });
  // If both provided, ensure they match
  if (hdr && bodyAddr && hdr.toLowerCase() !== bodyAddr.toLowerCase()) {
    return res.status(401).json({ error: "Wallet mismatch" });
  }
  req.walletAddress = (hdr || bodyAddr).toString();
  return next();
}

const router = express.Router();

// Ensure MongoDB is available
function requireDatabase(_req, res, next) {
  if (!isMongoConnected()) {
    return res.status(503).json({
      error: "Database not available",
      message: "Please configure MongoDB Atlas. See SETUP.md for instructions.",
    });
  }
  next();
}

// Load trainer by wallet address
router.get("/trainer/load/:walletAddress", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const doc = await Trainer.findOne({ walletAddress });
    if (!doc) return res.status(404).json({ error: "Trainer not found" });
    return res.json({ trainer: doc });
  } catch (e) {
    return res.status(500).json({ error: "Failed to load trainer" });
  }
});

// Save full trainer snapshot (atomic per document)
router.post("/trainer/save", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.walletAddress) return res.status(400).json({ error: "walletAddress required" });

    const now = new Date();
    const update = {
      username: payload.username,
      level: Number.isFinite(payload.level) ? payload.level : undefined,
      xp: Number.isFinite(payload.xp) ? payload.xp : undefined,
      team: Array.isArray(payload.team) ? payload.team : undefined,
      storage: Array.isArray(payload.storage) ? payload.storage : undefined,
      inventory: payload.inventory || undefined,
      location: payload.location || undefined,
      timestamp: now,
    };
    const push = {};
    if (Array.isArray(payload.teamAppend) && payload.teamAppend.length) push["team"] = { $each: payload.teamAppend };
    if (Array.isArray(payload.storageAppend) && payload.storageAppend.length) push["storage"] = { $each: payload.storageAppend };
    // Remove undefined to avoid overwriting
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const updateDoc = { $set: update, $setOnInsert: { walletAddress: payload.walletAddress } };
    if (Object.keys(push).length) updateDoc.$push = push;

    const doc = await Trainer.findOneAndUpdate(
      { walletAddress: payload.walletAddress },
      updateDoc,
      { new: true, upsert: true }
    );
    return res.json({ success: true, trainer: doc });
  } catch (e) {
    return res.status(500).json({ error: "Failed to save trainer" });
  }
});

// Patch inventory and XP/level deltas
router.patch("/trainer/updateInventory", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress, xpDelta, level, inventoryDelta, location } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

    const inc = {};
    if (Number.isFinite(xpDelta)) inc["xp"] = xpDelta;
    const set = {};
    if (Number.isFinite(level)) set["level"] = level;
    if (inventoryDelta) {
      Object.entries(inventoryDelta).forEach(([k, v]) => {
        if (Number.isFinite(v)) inc[`inventory.${k}`] = v;
      });
    }
    if (location) set["location"] = location;
    set["timestamp"] = new Date();

    const doc = await Trainer.findOneAndUpdate(
      { walletAddress },
      { ...(Object.keys(inc).length ? { $inc: inc } : {}), ...(Object.keys(set).length ? { $set: set } : {}) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Trainer not found" });
    return res.json({ success: true, trainer: doc });
  } catch (e) {
    return res.status(500).json({ error: "Failed to update inventory" });
  }
});

// Autosave lightweight endpoint
router.post("/autosave", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress, xp, level, inventory, location } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
    const set = { timestamp: new Date() };
    if (Number.isFinite(xp)) set["xp"] = xp;
    if (Number.isFinite(level)) set["level"] = level;
    if (inventory) set["inventory"] = inventory;
    if (location) set["location"] = location;

    const doc = await Trainer.findOneAndUpdate(
      { walletAddress },
      { $set: set, $setOnInsert: { walletAddress } },
      { new: true, upsert: true }
    );
    return res.json({ success: true, trainer: doc });
  } catch (e) {
    return res.status(500).json({ error: "Autosave failed" });
  }
});

// Daily backup to IPFS
router.post("/trainer/backup", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

    const doc = await Trainer.findOne({ walletAddress });
    if (!doc) return res.status(404).json({ error: "Trainer not found" });

    // Lazy import to avoid startup cost if unused
    const { create } = await import("ipfs-http-client");
    const projectId = process.env.IPFS_PROJECT_ID;
    const projectSecret = process.env.IPFS_PROJECT_SECRET;
    let client;
    if (projectId && projectSecret) {
      const auth = "Basic " + Buffer.from(projectId + ":" + projectSecret).toString("base64");
      client = create({
        host: process.env.IPFS_HOST || "ipfs.infura.io",
        port: Number(process.env.IPFS_PORT || 5001),
        protocol: process.env.IPFS_PROTOCOL || "https",
        headers: { authorization: auth },
      });
    } else {
      // Public client (may rate limit)
      client = create({ url: process.env.IPFS_API_URL || "https://ipfs.infura.io:5001/api/v0" });
    }

    const payload = JSON.stringify({
      walletAddress: doc.walletAddress,
      username: doc.username,
      level: doc.level,
      xp: doc.xp,
      team: doc.team,
      storage: doc.storage,
      inventory: doc.inventory,
      location: doc.location,
      timestamp: new Date().toISOString(),
    });
    const result = await client.add(payload, { pin: true });

    const ipfsHash = result.cid.toString();
    doc.ipfsBackupHash = ipfsHash;
    await doc.save();

    return res.json({ success: true, ipfsHash });
  } catch (e) {
    return res.status(500).json({ error: "Backup failed" });
  }
});

// On-chain XP sync
router.post('/trainer/xpSync', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, newXP } = req.body || {};
    if (!walletAddress || !Number.isFinite(newXP)) return res.status(400).json({ error: 'walletAddress and newXP required' });

    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    // Update DB first
    const level = trainer.level || 1;
    const currentLevelXPNeeded = Math.max(trainer.nextLevelXP || 100, 1);
    let remaining = newXP;
    let newLevel = level;
    let currentXP = trainer.currentXP || 0;
    let nextLevelXP = trainer.nextLevelXP || 100;

    // Recalculate level from total XP
    newLevel = 1;
    remaining = newXP;
    while (remaining >= (100 * Math.pow(newLevel, 2))) {
      remaining -= 100 * Math.pow(newLevel, 2);
      newLevel += 1;
    }
    currentXP = remaining;
    nextLevelXP = 100 * Math.pow(newLevel, 2);

    const updated = await Trainer.findOneAndUpdate(
      { walletAddress },
      { $set: { xp: newXP, level: newLevel, currentXP, nextLevelXP, timestamp: new Date() } },
      { new: true }
    );

    // Call Algorand app (optional)
    try {
      const { updateXPOnChain } = await import('../services/algorand.js');
      const appId = Number(process.env.TRAINER_XP_APP_ID || 0);
      if (appId > 0) {
        await updateXPOnChain({ appId, wallet: walletAddress, xp: newXP });
      }
    } catch {}

    return res.json({ success: true, trainer: updated });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to sync XP' });
  }
});

export default router;
