export type BiomeId = "grassland" | "desert" | "lake" | "city" | "mountain" | "cave" | "forest" | "snowfield" | "tower" | "lab" | "temple";

export interface BiomeDef {
  id: BiomeId;
  name: string;
  environmentColor: number; // hex color for overlay
  tileSet: {
    ground: string; // key used in Phaser textures manager
    obstacle: string;
  };
  pokemonPool: string[]; // type names to prefer
  weather?: "fog" | "snow" | "sun" | "none";
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  grassland: {
    id: "grassland",
    name: "Grassland",
    environmentColor: 0x87cc5c,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["grass", "bug", "normal", "flying"],
    weather: "sun",
  },
  desert: {
    id: "desert",
    name: "Desert",
    environmentColor: 0xdeb887,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["ground", "rock", "fire"],
    weather: "sun",
  },
  lake: {
    id: "lake",
    name: "Lake",
    environmentColor: 0x66a3ff,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["water", "dragon", "fairy"],
    weather: "fog",
  },
  city: {
    id: "city",
    name: "City",
    environmentColor: 0x999999,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["electric", "normal", "steel", "fighting"],
    weather: "none",
  },
  mountain: {
    id: "mountain",
    name: "Mountain",
    environmentColor: 0xb0c4de,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["rock", "ground", "ice", "dragon"],
    weather: "snow",
  },
  cave: {
    id: "cave",
    name: "Cave",
    environmentColor: 0x444444,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["rock", "ground", "poison", "dark"],
    weather: "fog",
  },
  forest: {
    id: "forest",
    name: "Forest",
    environmentColor: 0x2f6f4f,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["grass", "bug", "fairy"],
    weather: "fog",
  },
  snowfield: {
    id: "snowfield",
    name: "Snowfield",
    environmentColor: 0xe0f7ff,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["ice", "water"],
    weather: "snow",
  },
  tower: {
    id: "tower",
    name: "Ancient Tower",
    environmentColor: 0x551a8b,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["ghost", "dark"],
    weather: "fog",
  },
  lab: {
    id: "lab",
    name: "Research Lab",
    environmentColor: 0xccccff,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["electric", "steel", "psychic"],
    weather: "none",
  },
  temple: {
    id: "temple",
    name: "Desert Temple",
    environmentColor: 0xc2b280,
    tileSet: { ground: "tilesheet", obstacle: "tilesheet" },
    pokemonPool: ["ground", "rock", "fire"],
    weather: "sun",
  },
};

export type StructureType = "house" | "tower" | "lab" | "temple";
export interface StructureDef { id: string; type: StructureType; col: number; row: number; x: number; y: number; }
