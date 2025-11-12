/**
 * Battle Routes
 * Comprehensive server-side battle validation system
 * Supports PVP, Gym battles, and XP management
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import BattleSession from '../models/BattleSession.js';
import Trainer from '../models/Trainer.js';
import { isMongoConnected } from '../db.js';
import battleEngine from '../services/battleEngine.js';
import xpService from '../services/xpService.js';

const router = express.Router();

function requireDatabase(_req, res, next) {
  if (!isMongoConnected()) return res.status(503).json({ error: 'Database not available' });
  next();
}

/** Helper: Get wallet address from request */
function getWalletAddress(req) {
  return req.headers['x-wallet-address'] || req.body.walletAddress;
}

/** Helper: Convert trainer team to battle format */
function preparePokemonTeam(trainerTeam) {
  return trainerTeam.map((pokemon, index) => ({
    uid: pokemon._id?.toString() || `${pokemon.pokeId}-${index}`,
    pokeId: pokemon.pokeId,
    name: pokemon.name,
    level: pokemon.level,
    currentHP: pokemon.hp,
    maxHP: pokemon.hp,
    attack: pokemon.attack,
    defense: pokemon.defense,
    speed: pokemon.speed || 50,
    moves: pokemon.moves || ['tackle'],
    status: 'active',
  }));
}

/**
 * POST /api/battle/create
 * Create a new battle session (PVP or Gym)
 */
router.post('/create', requireDatabase, async (req, res) => {
  try {
    const walletAddress = getWalletAddress(req);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { type, opponent, seed: customSeed } = req.body;
    
    if (!type || !['pvp', 'gym'].includes(type)) {
      return res.status(400).json({ error: 'Invalid battle type (pvp or gym)' });
    }

    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer || !trainer.team || trainer.team.length === 0) {
      return res.status(400).json({ error: 'No team found' });
    }

    let opponentAddress = opponent;
    let opponentTrainer;
    
    if (type === 'gym') {
      opponentAddress = 'gym-' + (opponent || 'default');
      opponentTrainer = {
        team: [
          { pokeId: 7, name: 'Squirtle', level: 10, hp: 30, attack: 15, defense: 15, moves: ['tackle', 'waterGun'] },
          { pokeId: 4, name: 'Charmander', level: 12, hp: 35, attack: 18, defense: 12, moves: ['scratch', 'ember'] },
        ],
      };
    } else {
      if (!opponent) {
        return res.status(400).json({ error: 'Opponent required for PVP' });
      }
      opponentTrainer = await Trainer.findOne({ walletAddress: opponent });
      if (!opponentTrainer || !opponentTrainer.team || opponentTrainer.team.length === 0) {
        return res.status(400).json({ error: 'Opponent has no team' });
      }
    }

    const sessionId = uuidv4();
    const seed = customSeed || crypto.randomBytes(16).toString('hex');

    const session = new BattleSession({
      sessionId,
      type,
      seed,
      players: [
        {
          walletAddress,
          team: preparePokemonTeam(trainer.team.slice(0, 6)),
          active: 0,
        },
        {
          walletAddress: opponentAddress,
          team: preparePokemonTeam(opponentTrainer.team.slice(0, 6)),
          active: 0,
        },
      ],
      status: 'created',
    });

    await session.save();

    res.json({
      success: true,
      sessionId,
      seed,
      players: session.players.map(p => ({
        walletAddress: p.walletAddress,
        teamSize: p.team.length,
      })),
    });
  } catch (error) {
    console.error('Create battle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/battle/action
 * Submit a battle action
 */
router.post('/action', requireDatabase, async (req, res) => {
  try {
    const walletAddress = getWalletAddress(req);
    const { sessionId, action, signature } = req.body;

    if (!sessionId || !action) {
      return res.status(400).json({ error: 'Session ID and action required' });
    }

    const session = await BattleSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.type === 'pvp' && !session.isParticipant(walletAddress)) {
      return res.status(403).json({ error: 'Not a participant' });
    }

    action.signature = signature;
    const result = await battleEngine.processAction(sessionId, action);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Battle action error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/battle/session/:sessionId
 * Get battle session state
 */
router.get('/session/:sessionId', requireDatabase, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await BattleSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session: session.toObject() });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/battle/finish
 * Finish battle and award rewards
 */
router.post('/finish', requireDatabase, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await BattleSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'finished') {
      return res.status(400).json({ error: 'Battle not finished yet' });
    }

    if (!session.rewards.winner.playerXP && !session.rewards.loser.playerXP) {
      const winner = session.winner;
      const loser = session.players.find(p => p.walletAddress !== winner)?.walletAddress;
      const loserData = session.players.find(p => p.walletAddress === loser);
      
      if (loserData) {
        const avgLevel = Math.floor(
          loserData.team.reduce((sum, p) => sum + p.level, 0) / loserData.team.length
        );

        if (winner && !winner.startsWith('gym-')) {
          const winnerRewards = await xpService.awardBattleRewards(winner, session.type, avgLevel, true);
          session.rewards.winner = {
            playerXP: winnerRewards.playerXP,
            pokemonXP: winnerRewards.playerXP,
          };
        }

        if (loser && !loser.startsWith('gym-')) {
          const loserRewards = await xpService.awardBattleRewards(loser, session.type, avgLevel, false);
          session.rewards.loser = {
            playerXP: loserRewards.playerXP,
            pokemonXP: loserRewards.playerXP,
          };
        }

        await session.save();
      }
    }

    res.json({ success: true, winner: session.winner, rewards: session.rewards });
  } catch (error) {
    console.error('Finish battle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/battle/auto-resolve
 * Auto-resolve gym/AI battle
 */
router.post('/auto-resolve', requireDatabase, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await BattleSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.type === 'pvp') {
      return res.status(400).json({ error: 'Cannot auto-resolve PVP battles' });
    }

    const result = await battleEngine.autoResolveBattle(sessionId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Auto-resolve error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/battle/replay/:sessionId
 * Replay battle for verification
 */
router.get('/replay/:sessionId', requireDatabase, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await battleEngine.replayBattle(sessionId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Replay error:', error);
    res.status(500).json({ error: error.message });
  }
});

/** LEGACY ENDPOINTS (keep for backward compatibility) */

// POST /api/battle/start (legacy - for wild battles)
router.post('/start', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, wild } = req.body || {};
    if (!walletAddress || !wild) return res.status(400).json({ error: 'walletAddress and wild required' });
    return res.json({ ok: true, message: 'Battle session started', seed: Math.floor(Math.random() * 1e9) });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to start battle' });
  }
});

// POST /api/battle/resolve (legacy - for wild battles)
router.post('/resolve', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, outcome, wildLevel = 1, rarity = 'common' } = req.body || {};
    if (!walletAddress || !outcome) return res.status(400).json({ error: 'walletAddress and outcome required' });

    const trainer = await Trainer.findOne({ walletAddress });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    let xpDelta = 0;
    if (outcome === 'victory') {
      const rarityBonus = { common: 0, rare: 5, epic: 12, legendary: 25, mythic: 40 }[String(rarity).toLowerCase()] ?? 0;
      xpDelta = 10 + wildLevel * 2 + rarityBonus;
    } else if (outcome === 'defeat') {
      xpDelta = -Math.max(1, Math.floor((10 + wildLevel * 2) * 0.25));
    }

    const result = await xpService.awardPlayerXP(walletAddress, Math.max(0, xpDelta));
    const captured = outcome === 'victory' && Math.random() < 0.25;

    return res.json({ success: true, xpGained: xpDelta, leveledUp: result.leveled, captured, trainer: result });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to resolve battle' });
  }
});

/** XP ENDPOINTS */

// GET /api/battle/xp/player/:wallet
router.get('/xp/player/:wallet', requireDatabase, async (req, res) => {
  try {
    const { wallet } = req.params;
    const trainer = await Trainer.findOne({ walletAddress: wallet });
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({
      success: true,
      level: trainer.level,
      xp: trainer.xp,
      currentXP: trainer.currentXP,
      nextLevelXP: trainer.nextLevelXP,
    });
  } catch (error) {
    console.error('Get player XP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/battle/xp/test-award (admin/testing)
router.post('/xp/test-award', requireDatabase, async (req, res) => {
  try {
    const { walletAddress, xp } = req.body;

    if (!walletAddress || !xp) {
      return res.status(400).json({ error: 'Wallet address and XP required' });
    }

    const result = await xpService.awardPlayerXP(walletAddress, xp);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Test award XP error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
