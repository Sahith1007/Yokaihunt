/**
 * Battle System Smoke Test
 * Tests determinism, XP calculations, and battle flow
 */

import mongoose from 'mongoose';
import battleEngine from '../services/battleEngine.js';
import xpService from '../services/xpService.js';
import BattleSession from '../models/BattleSession.js';
import Trainer from '../models/Trainer.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yokaihunt';

// Test data
const TEST_WALLET_A = 'test-wallet-a-' + Date.now();
const TEST_WALLET_B = 'test-wallet-b-' + Date.now();

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function cleanup() {
  try {
    await Trainer.deleteMany({ walletAddress: { $in: [TEST_WALLET_A, TEST_WALLET_B] } });
    await BattleSession.deleteMany({});
    console.log('✓ Cleanup complete');
  } catch (error) {
    console.error('✗ Cleanup error:', error);
  }
}

async function setupTestTrainers() {
  console.log('\n=== Setting up test trainers ===');
  
  const trainerA = new Trainer({
    walletAddress: TEST_WALLET_A,
    username: 'TestTrainerA',
    level: 1,
    xp: 0,
    currentXP: 0,
    nextLevelXP: 100,
    team: [
      {
        pokeId: 25,
        name: 'Pikachu',
        level: 10,
        hp: 30,
        attack: 15,
        defense: 10,
        speed: 60,
        moves: ['thunderShock', 'quickAttack'],
      },
    ],
  });

  const trainerB = new Trainer({
    walletAddress: TEST_WALLET_B,
    username: 'TestTrainerB',
    level: 1,
    xp: 0,
    currentXP: 0,
    nextLevelXP: 100,
    team: [
      {
        pokeId: 1,
        name: 'Bulbasaur',
        level: 10,
        hp: 30,
        attack: 12,
        defense: 12,
        speed: 45,
        moves: ['tackle', 'vineWhip'],
      },
    ],
  });

  await trainerA.save();
  await trainerB.save();

  console.log('✓ Test trainers created');
  return { trainerA, trainerB };
}

async function testXPSystem() {
  console.log('\n=== Testing XP System ===');

  // Test 1: Player XP calculation
  const playerNextLevelXP = xpService.getPlayerNextLevelXP(1);
  console.log(`Player level 1 next XP: ${playerNextLevelXP} (expected: 100)`);
  if (playerNextLevelXP !== 100) {
    throw new Error('Player XP calculation failed');
  }

  // Test 2: Pokemon XP calculation
  const pokeNextLevelXP = xpService.getPokemonNextLevelXP(1);
  console.log(`Pokemon level 1 next XP: ${pokeNextLevelXP} (expected: 50)`);
  if (pokeNextLevelXP !== 50) {
    throw new Error('Pokemon XP calculation failed');
  }

  // Test 3: XP reward calculation
  const pvpXP = xpService.calculateXPReward('pvp', 10, true);
  console.log(`PVP victory XP (level 10): ${pvpXP} (expected: 200)`);
  if (pvpXP !== 200) {
    throw new Error('PVP XP calculation failed');
  }

  const gymXP = xpService.calculateXPReward('gym', 10, true);
  console.log(`Gym victory XP (level 10): ${gymXP} (expected: 150)`);
  if (gymXP !== 150) {
    throw new Error('Gym XP calculation failed');
  }

  // Test 4: Award player XP
  const result = await xpService.awardPlayerXP(TEST_WALLET_A, 150);
  console.log(`Player XP result:`, result);
  if (!result.leveled || result.newLevel !== 2) {
    throw new Error('Player level-up failed');
  }

  console.log('✓ XP system tests passed');
}

async function testBattleCreation() {
  console.log('\n=== Testing Battle Creation ===');

  const trainer = await Trainer.findOne({ walletAddress: TEST_WALLET_A });
  if (!trainer) throw new Error('Trainer A not found');

  // Create battle session
  const sessionId = 'test-session-' + Date.now();
  const seed = 'test-seed-12345';

  const session = new BattleSession({
    sessionId,
    type: 'gym',
    seed,
    players: [
      {
        walletAddress: TEST_WALLET_A,
        team: [{
          uid: 'pikachu-1',
          pokeId: 25,
          name: 'Pikachu',
          level: 10,
          currentHP: 30,
          maxHP: 30,
          attack: 15,
          defense: 10,
          speed: 60,
          moves: ['thunderShock', 'quickAttack'],
          status: 'active',
        }],
        active: 0,
      },
      {
        walletAddress: 'gym-default',
        team: [{
          uid: 'squirtle-1',
          pokeId: 7,
          name: 'Squirtle',
          level: 8,
          currentHP: 28,
          maxHP: 28,
          attack: 12,
          defense: 12,
          speed: 40,
          moves: ['tackle', 'waterGun'],
          status: 'active',
        }],
        active: 0,
      },
    ],
    status: 'created',
  });

  await session.save();
  console.log(`✓ Battle session created: ${sessionId}`);

  return sessionId;
}

async function testBattleEngine(sessionId) {
  console.log('\n=== Testing Battle Engine ===');

  // Process a few actions
  const actions = [
    { actorUid: 'pikachu-1', moveId: 'thunderShock', targetUid: 'squirtle-1' },
    { actorUid: 'squirtle-1', moveId: 'tackle', targetUid: 'pikachu-1' },
    { actorUid: 'pikachu-1', moveId: 'quickAttack', targetUid: 'squirtle-1' },
  ];

  for (const action of actions) {
    const result = await battleEngine.processAction(sessionId, action);
    console.log(`Action processed: ${action.moveId} -> ${result.action.damage} damage, hit: ${result.action.accuracy}`);
    
    if (result.battleOver) {
      console.log(`✓ Battle ended, winner: ${result.winner}`);
      break;
    }
  }

  console.log('✓ Battle engine tests passed');
}

async function testDeterminism(sessionId) {
  console.log('\n=== Testing Determinism (Replay) ===');

  const replayResult = await battleEngine.replayBattle(sessionId);
  
  console.log(`Replay results:`);
  console.log(`- All matches: ${replayResult.allMatch}`);
  console.log(`- Turns replayed: ${replayResult.replayResults.length}`);

  if (!replayResult.allMatch) {
    console.error('✗ Replay results do not match!');
    replayResult.replayResults.forEach((r, i) => {
      if (!r.match) {
        console.error(`  Turn ${r.turn}: expected ${r.expectedDamage}, got ${r.actualDamage}`);
      }
    });
    throw new Error('Determinism test failed');
  }

  console.log('✓ Determinism test passed');
}

async function testAutoResolve() {
  console.log('\n=== Testing Auto-Resolve ===');

  // Create a new battle for auto-resolve test
  const sessionId = 'auto-test-' + Date.now();
  const seed = 'auto-seed-' + Date.now();

  const session = new BattleSession({
    sessionId,
    type: 'gym',
    seed,
    players: [
      {
        walletAddress: TEST_WALLET_B,
        team: [{
          uid: 'bulbasaur-1',
          pokeId: 1,
          name: 'Bulbasaur',
          level: 10,
          currentHP: 30,
          maxHP: 30,
          attack: 12,
          defense: 12,
          speed: 45,
          moves: ['tackle', 'vineWhip'],
          status: 'active',
        }],
        active: 0,
      },
      {
        walletAddress: 'gym-default',
        team: [{
          uid: 'charmander-1',
          pokeId: 4,
          name: 'Charmander',
          level: 8,
          currentHP: 28,
          maxHP: 28,
          attack: 14,
          defense: 10,
          speed: 50,
          moves: ['scratch', 'ember'],
          status: 'active',
        }],
        active: 0,
      },
    ],
    status: 'created',
  });

  await session.save();

  const result = await battleEngine.autoResolveBattle(sessionId);
  console.log(`Auto-resolve result:`, result);
  console.log(`✓ Auto-resolve completed in ${result.turns} turns, winner: ${result.winner}`);
}

async function runTests() {
  console.log('Starting Battle System Smoke Tests...\n');

  try {
    await connectDB();
    await cleanup();
    await setupTestTrainers();
    await testXPSystem();
    
    const sessionId = await testBattleCreation();
    await testBattleEngine(sessionId);
    await testDeterminism(sessionId);
    await testAutoResolve();

    console.log('\n=== All Tests Passed! ===\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

runTests();
