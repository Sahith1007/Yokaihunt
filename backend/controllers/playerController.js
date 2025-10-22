import prisma from '../db/prisma.js';

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
