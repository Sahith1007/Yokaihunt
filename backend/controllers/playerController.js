import prisma from '../db/prisma.js';

// Calculate level from total experience (Pokemon-style formula)
function calculateLevel(totalExp) {
  // Level 1: 0 XP
  // Level 2: 100 XP
  // Level 3: 300 XP
  // Level n: sum of (n-1)^3 
  // Simplified: Use cubic root approximation
  return Math.floor(Math.pow(totalExp / 100, 1/3)) + 1;
}

function experienceForLevel(level) {
  return Math.floor(Math.pow(level - 1, 3) * 100);
}

export async function registerPlayer(req, res) {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: 'username is required' });
    }

    const existing = await prisma.player.findUnique({ where: { username } });
    if (existing) {
      return res.json({ message: 'Player exists', playerId: existing.id });
    }

    const player = await prisma.player.create({ data: { username } });
    return res.status(201).json({ message: 'Player created', playerId: player.id });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to register player' });
  }
}

export async function addExperience(req, res) {
  try {
    const { playerId, experience } = req.body || {};
    
    if (!playerId || experience == null) {
      return res.status(400).json({ message: 'playerId and experience are required' });
    }
    
    const player = await prisma.player.findUnique({ where: { id: Number(playerId) } });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Calculate new total experience
    const totalExp = (player.totalExperience || 0) + Number(experience);
    const newLevel = calculateLevel(totalExp);
    const oldLevel = calculateLevel(player.totalExperience || 0);
    const leveledUp = newLevel > oldLevel;
    
    // Calculate experience in current level
    const currentLevelExp = experienceForLevel(newLevel);
    const nextLevelExp = experienceForLevel(newLevel + 1);
    const experienceInLevel = totalExp - currentLevelExp;
    
    // Update player
    const updated = await prisma.player.update({
      where: { id: Number(playerId) },
      data: {
        totalExperience: totalExp,
        experience: experienceInLevel,
        trainerLevel: newLevel,
      }
    });
    
    return res.json({
      success: true,
      leveledUp,
      oldLevel,
      newLevel,
      totalExperience: totalExp,
      experienceInLevel,
      experienceToNextLevel: nextLevelExp - totalExp,
      player: updated
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ message: 'Failed to add experience', details: message });
  }
}

export async function getPlayerProgress(req, res) {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ message: 'playerId is required' });
    }
    
    const player = await prisma.player.findUnique({ where: { id: Number(playerId) } });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    const totalExp = player.totalExperience || 0;
    const level = player.trainerLevel || calculateLevel(totalExp);
    const currentLevelExp = experienceForLevel(level);
    const nextLevelExp = experienceForLevel(level + 1);
    const experienceInLevel = totalExp - currentLevelExp;
    const experienceToNextLevel = nextLevelExp - totalExp;
    
    return res.json({
      playerId: player.id,
      username: player.username,
      trainerLevel: level,
      experience: experienceInLevel,
      totalExperience: totalExp,
      experienceToNextLevel,
      battlesWon: player.battlesWon,
      battlesLost: player.battlesLost,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ message: 'Failed to get player progress', details: message });
  }
}
