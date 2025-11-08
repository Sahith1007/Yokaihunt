import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { isMongoConnected } from '../db.js';
import { getZoneId } from '../utils/zoneUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// In-memory spawn cache (per-zone)
const cache = new Map(); // zoneId -> spawns[]

function loadTables() {
  try {
    const p = path.join(__dirname, '../../config/spawnTables.json');
    const txt = fs.readFileSync(p, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

const tables = loadTables();

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function between(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function rollRarity(table, level) {
  const mult = 1 - Math.min(0.99, (level || 1) / 100);
  const weights = Object.entries(table.rarity || {});
  const r = Math.random();
  let cum = 0;
  for (const [name, w] of weights) {
    cum += (w || 0) * mult;
    if (r <= cum) return name;
  }
  return 'common';
}

function generateSpawn(biome, level, zoneId) {
  const t = tables[biome] || tables['grassland'] || { levels: { min: 1, max: 5 } };
  const lvl = between(t.levels.min, t.levels.max);
  const rarity = rollRarity(t, level);
  const pokeId = between(1, 898);
  
  // Generate spawn within zone bounds (10x10 tiles = 320x320 pixels)
  const zoneX = parseInt(zoneId.split('_')[1] || '0', 10);
  const zoneY = parseInt(zoneId.split('_')[2] || '0', 10);
  const zoneMinX = zoneX * 10 * 32;
  const zoneMinY = zoneY * 10 * 32;
  const zoneMaxX = zoneMinX + (10 * 32);
  const zoneMaxY = zoneMinY + (10 * 32);
  
  const x = between(zoneMinX + 32, zoneMaxX - 32);
  const y = between(zoneMinY + 32, zoneMaxY - 32);
  
  return { 
    id: uuidv4(), 
    pokemonId: pokeId,
    pokeId, 
    name: `poke-${pokeId}`, 
    level: lvl, 
    rarity, 
    x, 
    y, 
    biome, 
    zoneId,
    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`,
    expiresAt: Date.now() + 60000 // 60 seconds
  };
}

router.get('/spawn/sync', (req, res) => {
  const biome = (req.query.biome || 'grassland').toString();
  const level = Number(req.query.level || 1);
  const density = Math.max(1, Number(req.query.players || 1));
  const zoneId = req.query.zoneId?.toString() || getZoneId(Number(req.query.x || 0), Number(req.query.y || 0));
  const target = Math.min(8, Math.max(3, 3 + Math.floor(Math.random() * 5) + Math.floor(density / 3)));

  // Get or create spawns for this zone
  const zoneKey = `${zoneId}_${biome}`;
  const list = (cache.get(zoneKey) || []).filter(s => s.expiresAt > Date.now() && s.zoneId === zoneId);
  
  // Repopulate if needed (every 30 seconds or if empty)
  while (list.length < target) {
    list.push(generateSpawn(biome, level, zoneId));
  }
  
  cache.set(zoneKey, list);
  
  // Cleanup old zones (keep only last 50 zones)
  if (cache.size > 50) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => {
      const aTime = Math.max(...(a[1] || []).map(s => s.expiresAt || 0));
      const bTime = Math.max(...(b[1] || []).map(s => s.expiresAt || 0));
      return bTime - aTime;
    });
    cache.clear();
    entries.slice(0, 50).forEach(([k, v]) => cache.set(k, v));
  }
  
  res.json({ biome, zoneId, spawns: list });
});

export default router;
