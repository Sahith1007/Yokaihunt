import express from "express";
import Trainer from "../models/Trainer.js";
import ActiveTrainer from "../models/ActiveTrainer.js";
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
    const now = new Date();
    const set = { timestamp: now };
    if (Number.isFinite(xp)) set["xp"] = xp;
    if (Number.isFinite(level)) set["level"] = level;
    if (inventory) set["inventory"] = inventory;
    if (location) set["location"] = location;

    const doc = await Trainer.findOneAndUpdate(
      { walletAddress },
      { $set: set, $setOnInsert: { walletAddress } },
      { new: true, upsert: true }
    );

    // Mirror activity into ActiveTrainer collection for presence
    if (location?.x != null && location?.y != null) {
      await ActiveTrainer.findOneAndUpdate(
        { walletAddress },
        {
          $set: {
            walletAddress,
            username: doc?.username || undefined,
            x: Number(location.x) || 0,
            y: Number(location.y) || 0,
            biome: location.biome || doc?.location?.biome || 'grassland',
            lastActive: now,
          },
        },
        { upsert: true, new: true }
      );
    }

    return res.json({ success: true, trainer: doc });
  } catch (e) {
    return res.status(500).json({ error: "Autosave failed" });
  }
});

// Manual backup to IPFS for a specific trainer
// Saves a JSON snapshot of the trainer document to IPFS and stores the CID
router.post("/trainer/backup", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: "Trainer not found" });

    const { getIpfsClient } = await import('../ipfs/ipfsClient.js');
    const ipfs = getIpfsClient();

    const snapshot = {
      walletAddress: trainer.walletAddress,
      username: trainer.username,
      level: trainer.level,
      xp: trainer.xp,
      currentXP: trainer.currentXP,
      nextLevelXP: trainer.nextLevelXP,
      team: trainer.team,
      storage: trainer.storage,
      inventory: trainer.inventory,
      location: trainer.location,
      timestamp: new Date().toISOString(),
      version: 1,
    };

    // Add to IPFS as JSON
    const resAdd = await ipfs.add(JSON.stringify(snapshot), { pin: true });
    const cid = resAdd.cid.toString();

    // Persist CID in MongoDB
    trainer.ipfsBackupHash = cid; // back-compat
    trainer.lastBackupCID = cid;
    trainer.timestamp = new Date();
    await trainer.save();

    console.log(`IPFS backup success for ${walletAddress}: ${cid}`);
    return res.json({ success: true, cid });
  } catch (e) {
    console.error('Backup failed:', e);
    return res.status(500).json({ error: "Backup failed" });
  }
});

// Publicly fetch trainer backup JSON by CID from IPFS (no DB required)
router.get('/trainer/ipfs/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    if (!cid) return res.status(400).json({ error: 'cid required' });
    const { getIpfsClient } = await import('../ipfs/ipfsClient.js');
    const ipfs = getIpfsClient();

    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    const text = buf.toString('utf-8');
    // Try JSON; if invalid JSON, just return text
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch {
      res.setHeader('content-type', 'text/plain');
      return res.send(text);
    }
  } catch (e) {
    console.error('IPFS fetch failed:', e);
    return res.status(500).json({ error: 'Failed to fetch from IPFS' });
  }
});

// Restore trainer data from last backup CID stored in MongoDB
router.get('/trainer/restore/:walletAddress', verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    const cid = trainer.lastBackupCID || trainer.ipfsBackupHash;
    if (!cid) return res.status(404).json({ error: 'No backup available' });

    const { getIpfsClient } = await import('../ipfs/ipfsClient.js');
    const ipfs = getIpfsClient();

    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    const json = JSON.parse(buf.toString('utf-8'));

    // Merge restored fields into MongoDB trainer
    const updated = await Trainer.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          username: json.username ?? trainer.username,
          level: json.level ?? trainer.level,
          xp: json.xp ?? trainer.xp,
          currentXP: json.currentXP ?? trainer.currentXP,
          nextLevelXP: json.nextLevelXP ?? trainer.nextLevelXP,
          team: Array.isArray(json.team) ? json.team : trainer.team,
          storage: Array.isArray(json.storage) ? json.storage : trainer.storage,
          inventory: json.inventory ?? trainer.inventory,
          location: json.location ?? trainer.location,
          timestamp: new Date(),
        }
      },
      { new: true }
    );

    console.log(`IPFS restore success for ${walletAddress}: ${cid}`);
    return res.json({ success: true, trainer: updated, cid });
  } catch (e) {
    console.error('Restore failed:', e);
    return res.status(500).json({ error: 'Restore failed' });
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

// ---- Battle Result ----

// Handle battle result: win/lose/caught with XP and Pokemon updates
router.post("/trainer/battleResult", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress, outcome, xpGained, caughtPokemon } = req.body || {};
    if (!walletAddress || !outcome) return res.status(400).json({ error: 'walletAddress and outcome required' });
    
    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    
    const updates = {};
    
    // Award XP
    if (Number.isFinite(xpGained) && xpGained > 0) {
      const newTotalXP = (trainer.xp || 0) + xpGained;
      
      // Calculate new level from total XP
      let newLevel = 1;
      let remaining = newTotalXP;
      while (remaining >= (100 * Math.pow(newLevel, 2))) {
        remaining -= 100 * Math.pow(newLevel, 2);
        newLevel += 1;
      }
      const currentXP = remaining;
      const nextLevelXP = 100 * Math.pow(newLevel, 2);
      
      updates.xp = newTotalXP;
      updates.level = newLevel;
      updates.currentXP = currentXP;
      updates.nextLevelXP = nextLevelXP;
    }
    
    // Add caught Pokemon to storage
    const pushUpdates = {};
if (outcome === 'caught' && caughtPokemon) {
      try {
        // Build metadata for IPFS backup of the caught Pokémon
        const meta = {
          name: caughtPokemon.name,
          pokeId: caughtPokemon.pokeId,
          level: caughtPokemon.level,
          rarity: caughtPokemon.rarity,
          types: (caughtPokemon.types || []),
          xp: 0,
          image: caughtPokemon.image_url,
          capturedAt: new Date().toISOString(),
        };
        const { getIpfsClient } = await import('../ipfs/ipfsClient.js');
        const ipfs = getIpfsClient();
        const added = await ipfs.add(JSON.stringify(meta), { pin: true });
        const metaCid = added.cid.toString();
        caughtPokemon.metadata_cid = metaCid;
      } catch (err) {
        // Continue without blocking the flow
        console.warn('Failed to pin caught pokemon metadata to IPFS:', err?.message || err);
      }
      pushUpdates.storage = caughtPokemon;
    }
    
    updates.timestamp = new Date();
    
    const updateDoc = { $set: updates };
    if (Object.keys(pushUpdates).length > 0) {
      updateDoc.$push = pushUpdates;
    }
    
    const updated = await Trainer.findOneAndUpdate(
      { walletAddress },
      updateDoc,
      { new: true }
    );
    
    return res.json({ success: true, trainer: updated, leveledUp: updated.level > (trainer.level || 1) });
  } catch (e) {
    console.error('Battle result error:', e);
    return res.status(500).json({ error: 'Failed to process battle result' });
  }
});

// ---- Active Trainers Presence ----

// Upsert active trainer on login/start session
router.post("/trainer/active/set", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress, username, x, y, biome } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const now = new Date();
    const doc = await ActiveTrainer.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          walletAddress,
          username,
          x: Number(x) || 0,
          y: Number(y) || 0,
          biome: biome || 'grassland',
          lastActive: now,
        },
      },
      { upsert: true, new: true }
    );
    return res.json({ success: true, active: doc });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set active trainer' });
  }
});

// Update position heartbeat every ~10s
router.post("/trainer/active/pos", verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const { walletAddress, x, y, biome } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const now = new Date();
    const doc = await ActiveTrainer.findOneAndUpdate(
      { walletAddress },
      { $set: { x: Number(x) || 0, y: Number(y) || 0, biome: biome || 'grassland', lastActive: now }, $setOnInsert: { walletAddress } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, active: doc });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update position' });
  }
});

// Nearby trainers within 10-tile radius (squared distance <= 100)
router.get('/trainer/nearby', verifyWalletSession, requireDatabase, async (req, res) => {
  try {
    const q = req.query || {};
    const x = Number(q.x);
    const y = Number(q.y);
    const biome = (q.biome || 'grassland').toString();
    if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ error: 'x and y required' });

    // Only same-biome trainers are considered nearby
    const since = new Date(Date.now() - 60 * 1000);
    const all = await ActiveTrainer.find({ biome, lastActive: { $gte: since } }).lean();
    const r2 = 10 * 10;
    const list = all
      .filter((t) => (t.walletAddress || '').toLowerCase() !== (req.walletAddress || '').toLowerCase())
      .filter((t) => {
        const dx = (Number(t.x) || 0) - x;
        const dy = (Number(t.y) || 0) - y;
        return dx * dx + dy * dy <= r2;
      })
      .map((t) => ({ walletAddress: t.walletAddress, username: t.username || 'Trainer', x: t.x, y: t.y, biome: t.biome, lastActive: t.lastActive }));
    return res.json({ trainers: list });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch nearby trainers' });
  }
});

export default router;
