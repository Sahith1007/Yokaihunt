import prisma from '../db/prisma.js';

function toRow(playerId, p) {
  return {
    playerId,
    name: p.name,
    sprite: p.sprite ?? null,
    typesJson: JSON.stringify(p.types || []),
    baseExp: p.baseExp ?? p.base_experience ?? null,
    hp: p.hp ?? null,
    attack: p.attack ?? null,
    defense: p.defense ?? null,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    sprite: row.sprite,
    types: (() => { try { return JSON.parse(row.typesJson || '[]'); } catch { return []; } })(),
    baseExp: row.baseExp ?? null,
    hp: row.hp ?? null,
    attack: row.attack ?? null,
    defense: row.defense ?? null,
    createdAt: row.createdAt,
  };
}

export async function addToInventory(req, res) {
  try {
    const { playerId, pokemon } = req.body || {};
    if (!playerId || !pokemon) return res.status(400).json({ message: 'playerId and pokemon are required' });

    const player = await prisma.player.findUnique({ where: { id: Number(playerId) } });
    if (!player) return res.status(404).json({ message: 'Player not found' });

    await prisma.pokemon.create({ data: toRow(Number(playerId), pokemon) });
    return res.json({ message: 'Pokemon added to inventory!' });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to add to inventory' });
  }
}

export async function listInventory(req, res) {
  try {
    const playerId = Number(req.params.playerId);
    const rows = await prisma.pokemon.findMany({ where: { playerId }, orderBy: { createdAt: 'desc' } });
    return res.json(rows.map(fromRow));
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch inventory' });
  }
}

export async function deleteFromInventory(req, res) {
  try {
    const playerId = Number(req.params.playerId);
    const pokemonId = Number(req.params.pokemonId);

    // Ensure item belongs to player
    const row = await prisma.pokemon.findUnique({ where: { id: pokemonId } });
    if (!row || row.playerId !== playerId) return res.status(404).json({ message: 'Not found' });

    await prisma.pokemon.delete({ where: { id: pokemonId } });
    return res.json({ message: 'Deleted' });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to delete' });
  }
}

export async function countInventory(req, res) {
  try {
    const playerId = Number(req.params.playerId);
    const count = await prisma.pokemon.count({ where: { playerId } });
    return res.json({ playerId, count });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to count inventory' });
  }
}
