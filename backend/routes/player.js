// backend/routes/player.js
// Player XP and level management

import express from 'express';
import Trainer from '../models/Trainer.js';

const router = express.Router();

/**
 * Calculate level from XP
 * level = Math.floor(Math.sqrt(xp / 50))
 */
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(Number(xp) / 50));
}

/**
 * Calculate XP required for next level
 */
function getXPForLevel(level) {
  return 50 * Math.pow(level, 2);
}

/**
 * Update player XP
 * POST /api/player/xp
 */
router.post('/player/xp', async (req, res) => {
  try {
    const { walletAddress, xp } = req.body;
    
    if (!walletAddress || xp === undefined) {
      return res.status(400).json({ error: 'walletAddress and xp required' });
    }

    const newLevel = calculateLevel(xp);
    const currentLevelXP = getXPForLevel(newLevel);
    const nextLevelXP = getXPForLevel(newLevel + 1);
    const currentXP = xp - currentLevelXP;

    const trainer = await Trainer.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          xp: Number(xp),
          level: newLevel,
          currentXP,
          nextLevelXP,
          timestamp: new Date()
        }
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      walletAddress,
      xp: trainer.xp,
      level: trainer.level,
      currentXP: trainer.currentXP,
      nextLevelXP: trainer.nextLevelXP
    });
  } catch (e) {
    console.error('XP update error:', e);
    return res.status(500).json({ error: 'Failed to update XP', details: e.message });
  }
});

/**
 * Get player XP
 * GET /api/player/xp?walletAddress=...
 */
router.get('/player/xp', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress?.toString();
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const trainer = await Trainer.findOne({ walletAddress }).lean();
    
    if (!trainer) {
      return res.json({
        walletAddress,
        xp: 0,
        level: 1,
        currentXP: 0,
        nextLevelXP: 50
      });
    }

    return res.json({
      walletAddress: trainer.walletAddress,
      xp: trainer.xp || 0,
      level: trainer.level || 1,
      currentXP: trainer.currentXP || 0,
      nextLevelXP: trainer.nextLevelXP || 50
    });
  } catch (e) {
    console.error('XP fetch error:', e);
    return res.status(500).json({ error: 'Failed to fetch XP', details: e.message });
  }
});

export default router;

