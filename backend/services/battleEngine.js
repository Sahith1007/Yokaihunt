/**
 * Battle Engine Service
 * Deterministic battle simulation with seeded randomness
 * Supports replay and verification
 */

import seedrandom from 'seedrandom';
import BattleSession from '../models/BattleSession.js';

// Move database (simplified - in production, query from PokeAPI or custom DB)
const MOVES = {
  tackle: { name: 'Tackle', power: 40, accuracy: 100, type: 'normal' },
  scratch: { name: 'Scratch', power: 40, accuracy: 100, type: 'normal' },
  ember: { name: 'Ember', power: 40, accuracy: 100, type: 'fire' },
  waterGun: { name: 'Water Gun', power: 40, accuracy: 100, type: 'water' },
  vineWhip: { name: 'Vine Whip', power: 45, accuracy: 100, type: 'grass' },
  thunderShock: { name: 'Thunder Shock', power: 40, accuracy: 100, type: 'electric' },
  quickAttack: { name: 'Quick Attack', power: 40, accuracy: 100, type: 'normal' },
  pound: { name: 'Pound', power: 40, accuracy: 100, type: 'normal' },
};

/**
 * Create a seeded random number generator
 */
function createRNG(seed, turn) {
  const combinedSeed = `${seed}-${turn}`;
  return seedrandom(combinedSeed);
}

/**
 * Calculate damage using Pokemon damage formula
 * Formula: damage = floor(((2 * level / 5 + 2) * attack * power) / (defense * 50)) + 2
 */
export function calculateDamage(attacker, defender, move, rng) {
  const level = attacker.level;
  const attack = attacker.attack;
  const defense = defender.defense;
  const power = move.power || 40;
  
  // Base damage calculation
  const baseDamage = Math.floor(
    ((2 * level / 5 + 2) * attack * power) / (defense * 50)
  ) + 2;
  
  // Apply random variance (85-100%)
  const randomMultiplier = 0.85 + (rng() * 0.15);
  const damage = Math.floor(baseDamage * randomMultiplier);
  
  return Math.max(1, damage); // Minimum 1 damage
}

/**
 * Check if move hits based on accuracy
 */
export function checkAccuracy(move, rng) {
  const accuracy = move.accuracy || 100;
  const roll = rng() * 100;
  return roll <= accuracy;
}

/**
 * Get pokemon by UID from session
 */
function getPokemonByUid(session, uid) {
  for (const player of session.players) {
    for (const pokemon of player.team) {
      if (pokemon.uid === uid) {
        return { pokemon, player };
      }
    }
  }
  return null;
}

/**
 * Get active pokemon for a player
 */
function getActivePokemon(player) {
  const activeIndex = player.active || 0;
  return player.team[activeIndex];
}

/**
 * Check if battle is over
 */
export function checkBattleOver(session) {
  const alliedPlayer = session.players[0];
  const enemyPlayer = session.players[1];
  
  const alliedAlive = alliedPlayer.team.some(p => p.currentHP > 0);
  const enemyAlive = enemyPlayer.team.some(p => p.currentHP > 0);
  
  if (!alliedAlive && !enemyAlive) {
    return { over: true, winner: null, draw: true };
  }
  
  if (!alliedAlive) {
    return { over: true, winner: enemyPlayer.walletAddress };
  }
  
  if (!enemyAlive) {
    return { over: true, winner: alliedPlayer.walletAddress };
  }
  
  return { over: false };
}

/**
 * Process a single action in the battle
 * Returns updated session state and action result
 */
export async function processAction(sessionId, action) {
  const session = await BattleSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  
  if (session.status === 'finished') {
    throw new Error('Battle already finished');
  }
  
  // Create RNG for this turn
  const rng = createRNG(session.seed, session.currentTurn);
  
  // Find attacker and target
  const attackerData = getPokemonByUid(session, action.actorUid);
  if (!attackerData) throw new Error('Attacker not found');
  
  const { pokemon: attacker, player: attackerPlayer } = attackerData;
  
  // Determine target (if not specified, target is opponent's active pokemon)
  let target;
  if (action.targetUid) {
    const targetData = getPokemonByUid(session, action.targetUid);
    if (!targetData) throw new Error('Target not found');
    target = targetData.pokemon;
  } else {
    // Auto-target opponent's active pokemon
    const opponent = session.players.find(p => p.walletAddress !== attackerPlayer.walletAddress);
    target = getActivePokemon(opponent);
  }
  
  // Get move data
  const move = MOVES[action.moveId] || MOVES.tackle;
  
  // Check accuracy
  const hit = checkAccuracy(move, rng);
  
  let damage = 0;
  if (hit) {
    damage = calculateDamage(attacker, target, move, rng);
    target.currentHP = Math.max(0, target.currentHP - damage);
    
    // If target fainted, switch to next available pokemon
    if (target.currentHP === 0) {
      target.status = 'fainted';
      
      // Find next conscious pokemon for that player
      const targetPlayer = session.players.find(p => 
        p.team.some(poke => poke.uid === target.uid)
      );
      
      if (targetPlayer) {
        const nextIndex = targetPlayer.team.findIndex(p => p.currentHP > 0);
        if (nextIndex !== -1) {
          targetPlayer.active = nextIndex;
        }
      }
    }
  }
  
  // Record action in log
  const actionRecord = {
    turn: session.currentTurn,
    actorUid: action.actorUid,
    moveId: action.moveId,
    targetUid: target.uid,
    damage,
    accuracy: hit,
    timestamp: new Date(),
    signature: action.signature,
  };
  
  session.actionLog.push(actionRecord);
  session.currentTurn += 1;
  
  // Check if battle is over
  const battleStatus = checkBattleOver(session);
  if (battleStatus.over) {
    session.status = 'finished';
    session.winner = battleStatus.winner;
    session.finishedAt = new Date();
  } else if (session.status === 'created') {
    session.status = 'active';
  }
  
  await session.save();
  
  return {
    success: true,
    action: actionRecord,
    battleOver: battleStatus.over,
    winner: battleStatus.winner,
    session: session.toObject(),
  };
}

/**
 * Replay battle from action log (for verification)
 * Returns final state
 */
export async function replayBattle(sessionId) {
  const session = await BattleSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  
  // Create a fresh copy of initial state
  const initialState = {
    players: JSON.parse(JSON.stringify(session.players)),
    seed: session.seed,
  };
  
  // Reset HP to initial values (stored in max HP)
  initialState.players.forEach(player => {
    player.team.forEach(pokemon => {
      pokemon.currentHP = pokemon.maxHP;
      pokemon.status = 'active';
    });
  });
  
  // Replay each action
  const results = [];
  for (let i = 0; i < session.actionLog.length; i++) {
    const action = session.actionLog[i];
    const rng = createRNG(session.seed, action.turn);
    
    // Find attacker and target from current state
    const attacker = initialState.players
      .flatMap(p => p.team)
      .find(poke => poke.uid === action.actorUid);
    
    const target = initialState.players
      .flatMap(p => p.team)
      .find(poke => poke.uid === action.targetUid);
    
    if (!attacker || !target) {
      results.push({ error: 'Pokemon not found in replay', action });
      continue;
    }
    
    // Get move
    const move = MOVES[action.moveId] || MOVES.tackle;
    
    // Recalculate
    const hit = checkAccuracy(move, rng);
    let damage = 0;
    
    if (hit) {
      damage = calculateDamage(attacker, target, move, rng);
      target.currentHP = Math.max(0, target.currentHP - damage);
    }
    
    results.push({
      turn: action.turn,
      expectedDamage: action.damage,
      actualDamage: damage,
      match: damage === action.damage && hit === action.accuracy,
    });
  }
  
  return {
    sessionId,
    replayResults: results,
    allMatch: results.every(r => r.match),
    finalState: initialState,
  };
}

/**
 * Auto-resolve battle (for AI or gym battles)
 * Simulates turn-by-turn combat until one side wins
 */
export async function autoResolveBattle(sessionId) {
  const session = await BattleSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  
  const maxTurns = 100; // Prevent infinite loops
  let turn = session.currentTurn;
  
  while (turn < maxTurns) {
    // Check if battle is over
    const battleStatus = checkBattleOver(session);
    if (battleStatus.over) {
      session.status = 'finished';
      session.winner = battleStatus.winner;
      session.finishedAt = new Date();
      await session.save();
      return { winner: battleStatus.winner, turns: turn };
    }
    
    // Determine who acts (simple: alternate between players)
    const actingPlayerIndex = turn % 2;
    const actingPlayer = session.players[actingPlayerIndex];
    const opponent = session.players[1 - actingPlayerIndex];
    
    // Get active pokemon
    const attacker = getActivePokemon(actingPlayer);
    const target = getActivePokemon(opponent);
    
    if (!attacker || attacker.currentHP <= 0) {
      // Switch to next pokemon
      const nextIndex = actingPlayer.team.findIndex(p => p.currentHP > 0);
      if (nextIndex === -1) break; // No pokemon left
      actingPlayer.active = nextIndex;
      turn++;
      continue;
    }
    
    // Choose a random move
    const availableMoves = attacker.moves || ['tackle'];
    const moveId = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    
    // Process action
    const action = {
      actorUid: attacker.uid,
      moveId,
      targetUid: target.uid,
    };
    
    await processAction(sessionId, action);
    turn++;
  }
  
  const updatedSession = await BattleSession.findOne({ sessionId });
  return {
    winner: updatedSession.winner,
    turns: turn,
    timedOut: turn >= maxTurns,
  };
}

export default {
  calculateDamage,
  checkAccuracy,
  processAction,
  replayBattle,
  autoResolveBattle,
  checkBattleOver,
};
