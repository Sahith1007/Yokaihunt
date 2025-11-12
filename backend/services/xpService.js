/**
 * XP Service
 * Handles all XP calculations, level-ups, stat increases, and evolution triggers
 */

import Trainer from '../models/Trainer.js';

// XP Formula Constants
const PLAYER_XP_BASE = 100; // Base XP for player level-up
const PLAYER_XP_EXPONENT = 2; // Quadratic growth
const POKEMON_XP_BASE = 50; // Base XP for pokemon level-up
const POKEMON_XP_EXPONENT = 2;

// Stat increase per level (can be randomized)
const STAT_INCREASE = {
  hp: 3,
  attack: 2,
  defense: 2,
  speed: 1,
};

// Evolution thresholds (pokeId -> level)
// Simplified - in production, fetch from PokeAPI evolution chains
const EVOLUTION_LEVELS = {
  1: 16,   // Bulbasaur -> Ivysaur
  2: 32,   // Ivysaur -> Venusaur
  4: 16,   // Charmander -> Charmeleon
  5: 36,   // Charmeleon -> Charizard
  7: 16,   // Squirtle -> Wartortle
  8: 36,   // Wartortle -> Blastoise
  25: 22,  // Pikachu -> Raichu (with Thunder Stone, but simplified as level)
  // Add more as needed
};

const EVOLUTION_MAP = {
  1: 2,   // Bulbasaur -> Ivysaur
  2: 3,   // Ivysaur -> Venusaur
  4: 5,   // Charmander -> Charmeleon
  5: 6,   // Charmeleon -> Charizard
  7: 8,   // Squirtle -> Wartortle
  8: 9,   // Wartortle -> Blastoise
  25: 26, // Pikachu -> Raichu
  // Add more mappings
};

/**
 * Calculate XP needed for next player level
 */
export function getPlayerNextLevelXP(level) {
  return PLAYER_XP_BASE * Math.pow(level, PLAYER_XP_EXPONENT);
}

/**
 * Calculate XP needed for next pokemon level
 */
export function getPokemonNextLevelXP(level) {
  return POKEMON_XP_BASE * Math.pow(level, POKEMON_XP_EXPONENT);
}

/**
 * Calculate XP reward based on battle type and opponent
 */
export function calculateXPReward(battleType, opponentLevel, won) {
  const baseXP = opponentLevel * 10;
  
  let multiplier = 1.0;
  if (battleType === 'pvp') multiplier = 2.0; // PVP gives double XP
  if (battleType === 'gym') multiplier = 1.5; // Gym gives 1.5x XP
  if (!won) multiplier *= 0.3; // Losers get 30% XP
  
  return Math.floor(baseXP * multiplier);
}

/**
 * Award XP to player and check for level up
 * Returns: { leveled, newLevel, newXP, nextLevelXP }
 */
export async function awardPlayerXP(walletAddress, xpGained) {
  const trainer = await Trainer.findOne({ walletAddress });
  if (!trainer) throw new Error('Trainer not found');
  
  trainer.xp = (trainer.xp || 0) + xpGained;
  trainer.currentXP = (trainer.currentXP || 0) + xpGained;
  
  let leveled = false;
  while (trainer.currentXP >= trainer.nextLevelXP) {
    trainer.currentXP -= trainer.nextLevelXP;
    trainer.level += 1;
    trainer.nextLevelXP = getPlayerNextLevelXP(trainer.level);
    leveled = true;
  }
  
  await trainer.save();
  
  return {
    leveled,
    newLevel: trainer.level,
    newXP: trainer.xp,
    currentXP: trainer.currentXP,
    nextLevelXP: trainer.nextLevelXP,
  };
}

/**
 * Award XP to a pokemon and handle level-ups
 * Returns: { leveled, newLevel, evolved, evolutionReady, newStats }
 */
export function awardPokemonXP(pokemon, xpGained) {
  // Initialize XP tracking if not present
  if (!pokemon.xp) pokemon.xp = 0;
  if (!pokemon.currentXP) pokemon.currentXP = 0;
  if (!pokemon.nextLevelXP) pokemon.nextLevelXP = getPokemonNextLevelXP(pokemon.level);
  
  pokemon.xp += xpGained;
  pokemon.currentXP += xpGained;
  
  const result = {
    leveled: false,
    newLevel: pokemon.level,
    evolved: false,
    evolutionReady: false,
    newStats: {
      hp: pokemon.hp,
      attack: pokemon.attack,
      defense: pokemon.defense,
      speed: pokemon.speed || 50,
    },
  };
  
  // Process level-ups
  while (pokemon.currentXP >= pokemon.nextLevelXP) {
    pokemon.currentXP -= pokemon.nextLevelXP;
    pokemon.level += 1;
    result.leveled = true;
    result.newLevel = pokemon.level;
    
    // Apply stat increases
    pokemon.hp += STAT_INCREASE.hp;
    pokemon.attack += STAT_INCREASE.attack;
    pokemon.defense += STAT_INCREASE.defense;
    if (!pokemon.speed) pokemon.speed = 50;
    pokemon.speed += STAT_INCREASE.speed;
    
    pokemon.nextLevelXP = getPokemonNextLevelXP(pokemon.level);
    
    // Check for evolution
    const evolveLevel = EVOLUTION_LEVELS[pokemon.pokeId];
    if (evolveLevel && pokemon.level >= evolveLevel) {
      result.evolutionReady = true;
    }
  }
  
  result.newStats = {
    hp: pokemon.hp,
    attack: pokemon.attack,
    defense: pokemon.defense,
    speed: pokemon.speed,
  };
  
  return result;
}

/**
 * Execute evolution for a pokemon
 * Note: This changes the pokemon's pokeId and recalculates base stats
 */
export function evolvePokemon(pokemon) {
  const newPokeId = EVOLUTION_MAP[pokemon.pokeId];
  if (!newPokeId) {
    return { evolved: false, reason: 'No evolution available' };
  }
  
  // Fetch new pokemon name (simplified - in production, query PokeAPI)
  const oldPokeId = pokemon.pokeId;
  pokemon.pokeId = newPokeId;
  
  // Apply evolution stat boost (simplified formula)
  const boostMultiplier = 1.2;
  pokemon.hp = Math.floor(pokemon.hp * boostMultiplier);
  pokemon.attack = Math.floor(pokemon.attack * boostMultiplier);
  pokemon.defense = Math.floor(pokemon.defense * boostMultiplier);
  
  return {
    evolved: true,
    oldPokeId,
    newPokeId,
    newStats: {
      hp: pokemon.hp,
      attack: pokemon.attack,
      defense: pokemon.defense,
    },
  };
}

/**
 * Batch award XP to multiple pokemon (e.g., entire team)
 */
export async function awardTeamXP(walletAddress, xpAmount) {
  const trainer = await Trainer.findOne({ walletAddress });
  if (!trainer) throw new Error('Trainer not found');
  
  const results = [];
  
  // Award XP to all team members
  for (const pokemon of trainer.team) {
    if (pokemon.hp > 0) { // Only conscious pokemon gain XP
      const result = awardPokemonXP(pokemon, xpAmount);
      results.push({
        uid: pokemon._id?.toString() || pokemon.name,
        name: pokemon.name,
        ...result,
      });
    }
  }
  
  await trainer.save();
  
  return results;
}

/**
 * Award rewards after battle completion
 * Handles both player and pokemon XP
 */
export async function awardBattleRewards(walletAddress, battleType, opponentLevel, won) {
  const xpReward = calculateXPReward(battleType, opponentLevel, won);
  
  // Award player XP
  const playerResult = await awardPlayerXP(walletAddress, xpReward);
  
  // Award pokemon XP to team
  const pokemonResults = await awardTeamXP(walletAddress, xpReward);
  
  return {
    playerXP: xpReward,
    playerResult,
    pokemonResults,
  };
}

/**
 * Get evolution status for a pokemon
 */
export function checkEvolutionStatus(pokemon) {
  const evolveLevel = EVOLUTION_LEVELS[pokemon.pokeId];
  const canEvolve = EVOLUTION_MAP[pokemon.pokeId] !== undefined;
  
  return {
    canEvolve,
    evolveLevel,
    ready: canEvolve && evolveLevel && pokemon.level >= evolveLevel,
    nextForm: EVOLUTION_MAP[pokemon.pokeId],
  };
}

/**
 * Admin/Test: Set pokemon level and recalculate stats
 */
export function setPokemonLevel(pokemon, targetLevel) {
  const currentLevel = pokemon.level;
  const levelDiff = targetLevel - currentLevel;
  
  if (levelDiff <= 0) return pokemon;
  
  // Apply stat increases for each level
  pokemon.level = targetLevel;
  pokemon.hp += STAT_INCREASE.hp * levelDiff;
  pokemon.attack += STAT_INCREASE.attack * levelDiff;
  pokemon.defense += STAT_INCREASE.defense * levelDiff;
  if (!pokemon.speed) pokemon.speed = 50;
  pokemon.speed += STAT_INCREASE.speed * levelDiff;
  
  // Recalculate XP requirements
  pokemon.currentXP = 0;
  pokemon.nextLevelXP = getPokemonNextLevelXP(targetLevel);
  
  return pokemon;
}

export default {
  getPlayerNextLevelXP,
  getPokemonNextLevelXP,
  calculateXPReward,
  awardPlayerXP,
  awardPokemonXP,
  evolvePokemon,
  awardTeamXP,
  awardBattleRewards,
  checkEvolutionStatus,
  setPokemonLevel,
};
