const API_BASE = 'http://localhost:4000/api';

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
    const response = await fetch(`${API_BASE}/pokemon`);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
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
  } catch (error) {
    console.error('Failed to fetch player Pokémon:', error);
    return [];
  }
}

export async function getPlayerInventory(): Promise<{ pokeball: number; greatball: number; ultraball: number; masterball: number }> {
  try {
    const response = await fetch(`${API_BASE}/inventory`);
    
    if (!response.ok) return { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
    
    const data = await response.json();
    return data.balls || { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    return { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };
  }
}