import express from 'express';
import Trainer from '../models/Trainer.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

function requireDatabase(_req, res, next) {
  if (!isMongoConnected()) return res.status(503).json({ error: 'Database not available' });
  next();
}

function calcNextLevelXP(level) {
  // Simple curve: 100 * level^2
  return 100 * Math.pow(level, 2);
}

function applyXPGain(trainer, gainedXP) {
  const total = (trainer.xp || 0) + gainedXP;
  let level = trainer.level || 1;
  let next = trainer.nextLevelXP || calcNextLevelXP(level);
  let currentXP = trainer.currentXP || 0;

  currentXP += gainedXP;
  // Level up loop in case of big gains
  while (currentXP >= next) {
    currentXP -= next;
    level += 1;
    next = calcNextLevelXP(level);
  }

  return { totalXP: total, level, currentXP, nextLevelXP: next, leveledUp: level > (trainer.level || 1) };
}

// POST /api/battle/start (stub for future PvP)
router.post('/battle/start', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, wild } = req.body || {};
    if (!walletAddress || !wild) return res.status(400).json({ error: 'walletAddress and wild required' });
    return res.json({ ok: true, message: 'Battle session started', seed: Math.floor(Math.random() * 1e9) });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to start battle' });
  }
});

// POST /api/battle/resolve
router.post('/battle/resolve', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, outcome, wildLevel = 1, rarity = 'common' } = req.body || {};
    if (!walletAddress || !outcome) return res.status(400).json({ error: 'walletAddress and outcome required' });

    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    // XP gain/penalty
    let xpDelta = 0;
    if (outcome === 'victory') {
      const rarityBonus = { common: 0, rare: 5, epic: 12, legendary: 25, mythic: 40 }[String(rarity).toLowerCase()] ?? 0;
      xpDelta = 10 + wildLevel * 2 + rarityBonus;
    } else if (outcome === 'defeat') {
      xpDelta = -Math.max(1, Math.floor((10 + wildLevel * 2) * 0.25));
    }

    const nextStats = applyXPGain(trainer, Math.max(0, xpDelta));
    if (xpDelta < 0) {
      // clamp total and currentXP
      nextStats.totalXP = Math.max(0, (trainer.xp || 0) + xpDelta);
      nextStats.currentXP = Math.max(0, nextStats.currentXP + xpDelta); // rough clamp
    }

    const updated = await Trainer.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          xp: nextStats.totalXP,
          level: nextStats.level,
          currentXP: nextStats.currentXP,
          nextLevelXP: nextStats.nextLevelXP,
          timestamp: new Date(),
        },
      },
      { new: true }
    );

    // 25% capture chance on victory
    const captured = outcome === 'victory' && Math.random() < 0.25;

    return res.json({ success: true, xpGained: xpDelta, leveledUp: nextStats.leveledUp, captured, trainer: updated });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to resolve battle' });
  }
});

export default router;