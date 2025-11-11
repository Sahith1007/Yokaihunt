#!/usr/bin/env node
/**
 * Generate full gymLeaders.json
 *
 * Usage:
 *   node backend/scripts/generateGymLeaders.js
 * Output:
 *   data/gymLeaders.json (overwrites)
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const OUT = path.join(process.cwd(), 'data', 'gymLeaders.json');

// Compact template: leader -> team (species + level + moves). Add more regions as needed.
// For brevity here we include a subset; extend to all regions before production.
const TEMPLATE = [
  {
    id: 'kanto-brock', region: 'Kanto', order: 1, name: 'Brock', leaderNotes: 'Rock-type specialist', badgeId: 'kanto_rock_badge', difficulty: 1, rewardXP: 250,
    team: [
      { species: 'Geodude', level: 12, moves: ['Tackle', 'Defense Curl', 'Rock Throw', 'Magnitude'] },
      { species: 'Onix', level: 14, moves: ['Tackle', 'Bind', 'Rock Throw', 'Screech'] }
    ]
  },
  // ... add all leaders from all regions ...
];

async function fetchSpecies(name) {
  const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name.toLowerCase())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Species not found: ${name}`);
  const data = await res.json();
  return { id: data.id, spriteUrl: data.sprites?.front_default || null };
}

async function validateMove(name) {
  const url = `https://pokeapi.co/api/v2/move/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}`;
  const res = await fetch(url);
  return res.ok;
}

async function ensureValidTeam(team) {
  return Promise.all(team.map(async (m) => {
    const sp = await fetchSpecies(m.species);
    const validMoves = [];
    for (const mv of (m.moves || [])) {
      if (await validateMove(mv)) validMoves.push(mv); else console.warn('Invalid move, skipping:', mv);
    }
    return { ...m, spriteUrl: sp.spriteUrl, pokeId: sp.id, moves: validMoves };
  }));
}

async function main() {
  // Ensure unique badge IDs
  const seenBadge = new Set();
  for (const g of TEMPLATE) {
    if (seenBadge.has(g.badgeId)) throw new Error(`Duplicate badgeId: ${g.badgeId}`);
    seenBadge.add(g.badgeId);
  }

  const out = [];
  for (const g of TEMPLATE) {
    console.log('Building', g.id);
    const team = await ensureValidTeam(g.team);
    out.push({ ...g, team });
    await new Promise((r) => setTimeout(r, 120)); // rate-limit
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
