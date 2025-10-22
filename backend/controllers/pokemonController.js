import fetch from 'node-fetch';

// Simple in-memory cache
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '', 10) || 60 * 60 * 1000; // 1 hour default
const cache = new Map(); // key -> { data, expiresAt }

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache(key, data, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

function normalizeKey(idOrName) {
  return String(idOrName).trim().toLowerCase();
}

function cleanText(s) {
  return String(s || '').replace(/\f|\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapEvolutionChain(node) {
  if (!node) return null;
  return {
    species: node.species, // { name, url }
    evolves_to: Array.isArray(node.evolves_to) ? node.evolves_to.map(mapEvolutionChain) : [],
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed ${res.status} ${res.statusText} for ${url} ${text}`);
  }
  return res.json();
}

async function getPokemonCombined(idOrName) {
  const key = normalizeKey(idOrName);
  const cached = getCache(key);
  if (cached) return cached;

  const baseUrl = 'https://pokeapi.co/api/v2';
  const pokemonUrl = `${baseUrl}/pokemon/${encodeURIComponent(key)}`;

  // main pokemon data
  const pokemon = await fetchJson(pokemonUrl);

  // species (for description + evolution chain url)
  const species = await fetchJson(pokemon.species.url);
  const evoChainUrl = species?.evolution_chain?.url;

  // description
  const flavor = (species.flavor_text_entries || []).find((f) => f.language?.name === 'en');
  const description = flavor ? cleanText(flavor.flavor_text) : null;

  // evolution chain
  let evolution_chain = null;
  if (evoChainUrl) {
    const chain = await fetchJson(evoChainUrl);
    evolution_chain = mapEvolutionChain(chain.chain);
  }

  const data = {
    id: pokemon.id,
    name: pokemon.name,
    types: (pokemon.types || []).map((t) => t.type?.name).filter(Boolean),
    stats: (pokemon.stats || []).map((s) => ({ name: s.stat?.name, value: s.base_stat })),
    sprite: pokemon.sprites?.front_default || null,
    height: pokemon.height,
    weight: pokemon.weight,
    base_experience: pokemon.base_experience ?? null,
    description,
    evolution_chain,
  };

  // cache under both id and name
  setCache(normalizeKey(pokemon.id), data);
  setCache(normalizeKey(pokemon.name), data);

  return data;
}

export async function spawnPokemon(_req, res) {
  try {
    const randomId = Math.floor(Math.random() * 898) + 1; // 1..898
    const pokemon = await getPokemonCombined(randomId);
    return res.json({ message: `A wild ${pokemon.name} appeared!`, pokemon });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to spawn Pokémon', details: message });
  }
}

export async function catchPokemon(req, res) {
  try {
    const { pokemonId, name, hp, base_experience, playerId } = req.body || {};

    if (hp == null) {
      return res.status(400).json({ success: false, message: 'hp is required' });
    }

    const chance = Math.random() * 100;
    const threshold = 40 + Number(hp) / 10;

    if (chance > threshold) {
      return res.json({ success: false, message: 'The Pokémon escaped!' });
    }

    // On success, return detailed pokemon data
    const idOrName = pokemonId ?? name;
    let pokemon = null;
    if (idOrName != null) {
      try {
        pokemon = await getPokemonCombined(idOrName);
      } catch {
        // ignore fetch error, still mark success
      }
    }

    // Persist to inventory if playerId provided
    if (playerId && pokemon) {
      try {
        const { default: prisma } = await import('../db/prisma.js');
        await prisma.pokemon.create({
          data: {
            playerId: Number(playerId),
            name: pokemon.name,
            sprite: pokemon.sprite ?? null,
            typesJson: JSON.stringify(pokemon.types || []),
            baseExp: pokemon.base_experience ?? pokemon.baseExp ?? null,
            hp: (pokemon.stats || []).find((s) => s.name === 'hp')?.value ?? null,
            attack: (pokemon.stats || []).find((s) => s.name === 'attack')?.value ?? null,
            defense: (pokemon.stats || []).find((s) => s.name === 'defense')?.value ?? null,
          },
        });
      } catch {
        // ignore DB error for catch flow
      }
    }

    const displayName = (pokemon?.name || name || 'pokemon');
    return res.json({ success: true, message: `You caught ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}!`, pokemon });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ success: false, message: 'Failed to process catch', details: message });
  }
}

export async function getPokemonDetails(req, res) {
  try {
    const { id } = req.params;
    const pokemon = await getPokemonCombined(id);
    return res.json(pokemon);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (/404/.test(message)) {
      return res.status(404).json({ error: 'Pokémon not found' });
    }
    return res.status(500).json({ error: 'Failed to fetch Pokémon', details: message });
  }
}
