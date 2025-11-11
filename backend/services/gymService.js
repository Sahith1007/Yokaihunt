import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const DATA_PATH = path.join(process.cwd(), "data", "gymLeaders.json");

// In-memory cache
let cache = { gyms: [], byId: new Map() };

export function loadGyms() {
  if (!cache.gyms.length) {
    const txt = fs.readFileSync(DATA_PATH, "utf-8");
    const arr = JSON.parse(txt);
    cache.gyms = arr;
    cache.byId = new Map(arr.map((g) => [g.id, g]));
  }
  return cache;
}

export async function buildBattlePayload(gymId) {
  const { byId } = loadGyms();
  const gym = byId.get(gymId);
  if (!gym) throw new Error("Gym not found");

  // Use the first enemy as the wild target (reusing wild battle UI)
  const first = gym.team[0];
  const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(first.species.toLowerCase())}`);
  if (!pokeRes.ok) throw new Error("PokeAPI species missing: " + first.species);
  const pokeData = await pokeRes.json();
  const spriteUrl = pokeData?.sprites?.front_default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeData.id}.png`;

  return {
    type: "gym",
    gymId,
    enemyTeam: await Promise.all(
      gym.team.map(async (m) => {
        let data = null; let sprite = null; let pokeId = null;
        try {
          const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(m.species.toLowerCase())}`);
          if (r.ok) { data = await r.json(); pokeId = data.id; sprite = data?.sprites?.front_default; }
        } catch {}
        return { species: m.species, level: m.level, moves: m.moves, spriteUrl: sprite, pokeId, data };
      })
    ),
    allowCatch: false,
    allowRun: false,
    rewardXP: gym.rewardXP || 500,
  };
}

export function getAllGymIds() {
  return loadGyms().gyms.map((g) => g.id);
}
