const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || 'http://localhost:4000/api';

async function safeFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 3000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(input, { ...(init || {}), signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch {
    return null as unknown as Response;
  }
}

export interface PlayerPokemon {
  id: string;
  name: string;
  pokeId: number;
  level: number;
  currentHp: number;
  maxHp: number;
  stats: { name: string; value: number }[];
  types: string[];
  spriteUrl?: string;
}

export async function fetchPlayerPokemon(): Promise<PlayerPokemon[]> {
  try {
    const response = await safeFetch(`${API_BASE}/pokemon`);
    if (!response || !(response as any).ok) return [];
    const data = await (response as any).json();
    
    // Enhance with sprite URLs from PokéAPI
    const enhancedPokemon = await Promise.all(
      data.pokemon?.map(async (p: any) => {
        try {
          const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.pokeId}`);
          const pokeData = await pokeRes.json();
          const spriteUrl = pokeData?.sprites?.front_default || pokeData?.sprites?.other?.["official-artwork"]?.front_default;
          
          return {
            ...p,
            spriteUrl,
            data: pokeData // Store full PokéAPI data for battle stats
          };
        } catch {
          return p; // Return without sprite if API fails
        }
      }) || []
    );
    
    return enhancedPokemon;
  } catch {
    return [];
  }
}

export async function getPlayerInventory(): Promise<{ pokeball: number; greatball: number; ultraball: number; masterball: number }> {
  try {
    const response = await safeFetch(`${API_BASE}/inventory`);
    if (!response || !(response as any).ok) return { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
    const data = await (response as any).json();
    return data.balls || { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
  } catch {
    return { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
  }
}
