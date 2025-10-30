/**
 * Pokemon Type Effectiveness Chart and Damage Calculation
 * Based on canonical Pokemon mechanics
 */

export type PokemonType = 
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

/**
 * Type effectiveness multipliers
 * 2.0 = Super effective
 * 0.5 = Not very effective
 * 0.0 = Immune
 * 1.0 = Normal (not listed)
 */
type TypeChart = Record<PokemonType, Partial<Record<PokemonType, number>>>;

export const TYPE_EFFECTIVENESS: TypeChart = {
  normal: {
    rock: 0.5,
    ghost: 0.0,
    steel: 0.5,
  },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2.0,
    ice: 2.0,
    bug: 2.0,
    rock: 0.5,
    dragon: 0.5,
    steel: 2.0,
  },
  water: {
    fire: 2.0,
    water: 0.5,
    grass: 0.5,
    ground: 2.0,
    rock: 2.0,
    dragon: 0.5,
  },
  electric: {
    water: 2.0,
    electric: 0.5,
    grass: 0.5,
    ground: 0.0,
    flying: 2.0,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2.0,
    grass: 0.5,
    poison: 0.5,
    ground: 2.0,
    flying: 0.5,
    bug: 0.5,
    rock: 2.0,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2.0,
    ice: 0.5,
    ground: 2.0,
    flying: 2.0,
    dragon: 2.0,
    steel: 0.5,
  },
  fighting: {
    normal: 2.0,
    ice: 2.0,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2.0,
    ghost: 0.0,
    dark: 2.0,
    steel: 2.0,
    fairy: 0.5,
  },
  poison: {
    grass: 2.0,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0.0,
    fairy: 2.0,
  },
  ground: {
    fire: 2.0,
    electric: 2.0,
    grass: 0.5,
    poison: 2.0,
    flying: 0.0,
    bug: 0.5,
    rock: 2.0,
    steel: 2.0,
  },
  flying: {
    electric: 0.5,
    grass: 2.0,
    fighting: 2.0,
    bug: 2.0,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: {
    fighting: 2.0,
    poison: 2.0,
    psychic: 0.5,
    dark: 0.0,
    steel: 0.5,
  },
  bug: {
    fire: 0.5,
    grass: 2.0,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2.0,
    ghost: 0.5,
    dark: 2.0,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2.0,
    ice: 2.0,
    fighting: 0.5,
    ground: 0.5,
    flying: 2.0,
    bug: 2.0,
    steel: 0.5,
  },
  ghost: {
    normal: 0.0,
    psychic: 2.0,
    ghost: 2.0,
    dark: 0.5,
  },
  dragon: {
    dragon: 2.0,
    steel: 0.5,
    fairy: 0.0,
  },
  dark: {
    fighting: 0.5,
    psychic: 2.0,
    ghost: 2.0,
    dark: 0.5,
    fairy: 0.5,
  },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2.0,
    rock: 2.0,
    steel: 0.5,
    fairy: 2.0,
  },
  fairy: {
    fire: 0.5,
    fighting: 2.0,
    poison: 0.5,
    dragon: 2.0,
    dark: 2.0,
    steel: 0.5,
  },
};

/**
 * Get type effectiveness multiplier for attack type against defender types
 */
export function getTypeEffectiveness(attackType: PokemonType, defenderTypes: PokemonType[]): number {
  let multiplier = 1.0;
  
  for (const defType of defenderTypes) {
    const effectiveness = TYPE_EFFECTIVENESS[attackType]?.[defType];
    if (effectiveness !== undefined) {
      multiplier *= effectiveness;
    }
  }
  
  return multiplier;
}

/**
 * Get effectiveness description for UI
 */
export function getEffectivenessText(multiplier: number): string | null {
  if (multiplier === 0) return "No effect!";
  if (multiplier >= 4) return "It's super duper effective!";
  if (multiplier >= 2) return "It's super effective!";
  if (multiplier <= 0.25) return "It's barely effective...";
  if (multiplier <= 0.5) return "It's not very effective...";
  return null;
}

/**
 * Calculate damage using Pokemon damage formula
 * damage = (((2 * level / 5 + 2) * power * (attack / defense)) / 50 + 2) * modifiers
 * 
 * @param level - Attacking Pokemon's level
 * @param power - Move's power
 * @param attack - Attacking Pokemon's attack stat
 * @param defense - Defending Pokemon's defense stat
 * @param attackType - Type of the move
 * @param defenderTypes - Defending Pokemon's types
 * @returns Object with damage, type effectiveness multiplier, and effectiveness text
 */
export function calculateDamage(
  level: number,
  power: number,
  attack: number,
  defense: number,
  attackType: PokemonType,
  defenderTypes: PokemonType[]
): { damage: number; effectiveness: number; effectivenessText: string | null } {
  // Base damage calculation
  const levelFactor = (2 * level / 5 + 2);
  const attackDefenseRatio = attack / Math.max(1, defense);
  const baseDamage = (levelFactor * power * attackDefenseRatio) / 50 + 2;
  
  // Type effectiveness
  const typeMultiplier = getTypeEffectiveness(attackType, defenderTypes);
  
  // Random factor (0.85 to 1.0)
  const randomFactor = 0.85 + Math.random() * 0.15;
  
  // Calculate final damage
  const finalDamage = Math.floor(baseDamage * typeMultiplier * randomFactor);
  
  return {
    damage: Math.max(1, finalDamage), // Minimum 1 damage
    effectiveness: typeMultiplier,
    effectivenessText: getEffectivenessText(typeMultiplier),
  };
}

/**
 * Move database with type and power
 */
export interface Move {
  name: string;
  type: PokemonType;
  power: number;
  category: "physical" | "special";
}

export const MOVES: Record<string, Move> = {
  // Normal moves
  "tackle": { name: "Tackle", type: "normal", power: 40, category: "physical" },
  "scratch": { name: "Scratch", type: "normal", power: 40, category: "physical" },
  "quick-attack": { name: "Quick Attack", type: "normal", power: 40, category: "physical" },
  
  // Fire moves
  "ember": { name: "Ember", type: "fire", power: 40, category: "special" },
  "flamethrower": { name: "Flamethrower", type: "fire", power: 90, category: "special" },
  
  // Water moves
  "water-gun": { name: "Water Gun", type: "water", power: 40, category: "special" },
  "bubble": { name: "Bubble", type: "water", power: 40, category: "special" },
  
  // Grass moves
  "vine-whip": { name: "Vine Whip", type: "grass", power: 45, category: "physical" },
  "razor-leaf": { name: "Razor Leaf", type: "grass", power: 55, category: "physical" },
  
  // Electric moves
  "thunder-shock": { name: "Thunder Shock", type: "electric", power: 40, category: "special" },
  "thunderbolt": { name: "Thunderbolt", type: "electric", power: 90, category: "special" },
  
  // Other moves
  "powder-snow": { name: "Powder Snow", type: "ice", power: 40, category: "special" },
  "karate-chop": { name: "Karate Chop", type: "fighting", power: 50, category: "physical" },
  "poison-sting": { name: "Poison Sting", type: "poison", power: 15, category: "physical" },
  "mud-slap": { name: "Mud Slap", type: "ground", power: 20, category: "special" },
  "gust": { name: "Gust", type: "flying", power: 40, category: "special" },
  "confusion": { name: "Confusion", type: "psychic", power: 50, category: "special" },
  "bug-bite": { name: "Bug Bite", type: "bug", power: 60, category: "physical" },
  "rock-throw": { name: "Rock Throw", type: "rock", power: 50, category: "physical" },
  "lick": { name: "Lick", type: "ghost", power: 30, category: "physical" },
  "dragon-breath": { name: "Dragon Breath", type: "dragon", power: 60, category: "special" },
  "bite": { name: "Bite", type: "dark", power: 60, category: "physical" },
  "metal-claw": { name: "Metal Claw", type: "steel", power: 50, category: "physical" },
  "fairy-wind": { name: "Fairy Wind", type: "fairy", power: 40, category: "special" },
};

/**
 * Get move data, with fallback to default tackle
 */
export function getMoveData(moveName: string): Move {
  const normalizedName = moveName.toLowerCase().replace(/\s+/g, "-");
  return MOVES[normalizedName] || MOVES["tackle"];
}
