export type PokemonType = "fire" | "water" | "grass";

export interface StarterPokemon {
  id: number;
  name: string;
  displayName: string;
  type: PokemonType;
  sprite: string;
  level: number;
  data?: any; // Full PokeAPI data including moves
}

/**
 * Fetch Pokemon data from PokeAPI
 */
export async function getPokemon(name: string): Promise<any> {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${name}`);
    return await res.json();
  } catch (error) {
    console.error(`Error fetching Pokemon ${name}:`, error);
    return null;
  }
}

/**
 * Get the three starter Pokemon with their data
 */
export async function getStarterPokemon(): Promise<StarterPokemon[]> {
  const starters = [
    { name: "charmander", displayName: "Charmander", type: "fire" as PokemonType },
    { name: "squirtle", displayName: "Squirtle", type: "water" as PokemonType },
    { name: "bulbasaur", displayName: "Bulbasaur", type: "grass" as PokemonType },
  ];

  const promises = starters.map(async (starter) => {
    const data = await getPokemon(starter.name);
    return {
      id: data?.id || 0,
      name: starter.name,
      displayName: starter.displayName,
      type: starter.type,
      sprite: data?.sprites?.front_default || "",
      level: 1,
      data: data, // Include full PokeAPI data for battle moves
    };
  });

  return Promise.all(promises);
}

/**
 * Get type emoji for display
 */
export function getTypeEmoji(type: PokemonType): string {
  switch (type) {
    case "fire":
      return "🔥";
    case "water":
      return "💧";
    case "grass":
      return "🌿";
    default:
      return "⭐";
  }
}

/**
 * Get type color for styling
 */
export function getTypeColor(type: PokemonType): string {
  switch (type) {
    case "fire":
      return "from-red-500 to-orange-600";
    case "water":
      return "from-blue-500 to-cyan-600";
    case "grass":
      return "from-green-500 to-emerald-600";
    default:
      return "from-gray-500 to-slate-600";
  }
}

/**
 * Save selected starter to localStorage
 */
export function saveStarterPokemon(pokemon: StarterPokemon): void {
  localStorage.setItem("starterPokemon", JSON.stringify(pokemon));
}

/**
 * Load starter Pokemon from localStorage
 */
export function loadStarterPokemon(): StarterPokemon | null {
  const stored = localStorage.getItem("starterPokemon");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Check if player has selected a starter
 */
export function hasStarterPokemon(): boolean {
  return loadStarterPokemon() !== null;
}
