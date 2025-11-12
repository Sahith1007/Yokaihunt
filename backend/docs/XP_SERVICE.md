# XP Service Documentation

## Overview

The XP service manages all experience point calculations, level-ups, stat increases, and evolution triggers for both trainers and Pokemon.

## Formulas

### Player XP Requirements

Players require exponentially increasing XP to level up:

```
nextLevelXP = BASE * level^EXPONENT
```

**Constants:**
- `BASE = 100`
- `EXPONENT = 2`

**Examples:**
```
Level 1 → 2: 100 XP (100 * 1^2)
Level 2 → 3: 400 XP (100 * 2^2)
Level 3 → 4: 900 XP (100 * 3^2)
Level 4 → 5: 1600 XP (100 * 4^2)
Level 10 → 11: 10,000 XP (100 * 10^2)
```

### Pokemon XP Requirements

Pokemon level up faster than players:

```
nextLevelXP = BASE * level^EXPONENT
```

**Constants:**
- `BASE = 50`
- `EXPONENT = 2`

**Examples:**
```
Level 1 → 2: 50 XP (50 * 1^2)
Level 2 → 3: 200 XP (50 * 2^2)
Level 3 → 4: 450 XP (50 * 3^2)
Level 5 → 6: 1250 XP (50 * 5^2)
Level 10 → 11: 5,000 XP (50 * 10^2)
```

### Battle XP Rewards

XP rewards are calculated based on battle type and opponent level:

```
baseXP = opponentLevel * 10

if (battleType === 'pvp'):
    multiplier = 2.0
else if (battleType === 'gym'):
    multiplier = 1.5
else:
    multiplier = 1.0

if (!won):
    multiplier *= 0.3  // Losers get 30% XP

rewardXP = floor(baseXP * multiplier)
```

**Examples:**

| Battle Type | Opponent Level | Result | XP Reward |
|------------|----------------|--------|-----------|
| Wild | 10 | Win | 100 |
| Wild | 10 | Loss | 30 |
| Gym | 10 | Win | 150 |
| Gym | 10 | Loss | 45 |
| PVP | 10 | Win | 200 |
| PVP | 10 | Loss | 60 |
| PVP | 20 | Win | 400 |
| PVP | 50 | Win | 1000 |

## Stat Increases

When a Pokemon levels up, stats increase by fixed amounts:

```javascript
const STAT_INCREASE = {
  hp: 3,
  attack: 2,
  defense: 2,
  speed: 1,
};
```

**Example: Level 10 → 15 Pikachu**
```
Initial Stats:
- HP: 35
- Attack: 55
- Defense: 40
- Speed: 90

After 5 levels:
- HP: 35 + (3 * 5) = 50
- Attack: 55 + (2 * 5) = 65
- Defense: 40 + (2 * 5) = 50
- Speed: 90 + (1 * 5) = 95
```

## Evolution System

### Evolution Triggers

Pokemon evolve when they reach specific levels:

| Pokemon | Evolves To | Level Required |
|---------|-----------|---------------|
| Bulbasaur (1) | Ivysaur (2) | 16 |
| Ivysaur (2) | Venusaur (3) | 32 |
| Charmander (4) | Charmeleon (5) | 16 |
| Charmeleon (5) | Charizard (6) | 36 |
| Squirtle (7) | Wartortle (8) | 16 |
| Wartortle (8) | Blastoise (9) | 36 |
| Pikachu (25) | Raichu (26) | 22 |

### Evolution Stat Boost

Upon evolution, all stats are multiplied by **1.2**:

```javascript
newHP = floor(oldHP * 1.2)
newAttack = floor(oldAttack * 1.2)
newDefense = floor(oldDefense * 1.2)
```

**Example: Level 16 Charmander Evolution**
```
Charmander (Level 16):
- HP: 39 → 46
- Attack: 52 → 62
- Defense: 43 → 51

Charmeleon (Level 16 after evolution):
- HP: 46
- Attack: 62
- Defense: 51
```

## API Usage

### Award Player XP

```javascript
import xpService from '../services/xpService.js';

const result = await xpService.awardPlayerXP(walletAddress, 150);

// Result:
// {
//   leveled: true,
//   newLevel: 2,
//   newXP: 150,
//   currentXP: 50,
//   nextLevelXP: 400
// }
```

### Award Pokemon XP

```javascript
const pokemon = {
  pokeId: 25,
  name: 'Pikachu',
  level: 10,
  hp: 35,
  attack: 55,
  defense: 40,
  xp: 0,
  currentXP: 0,
  nextLevelXP: 5000
};

const result = xpService.awardPokemonXP(pokemon, 6000);

// Result:
// {
//   leveled: true,
//   newLevel: 11,
//   evolved: false,
//   evolutionReady: false,
//   newStats: {
//     hp: 38,
//     attack: 57,
//     defense: 42,
//     speed: 91
//   }
// }
```

### Check Evolution Status

```javascript
const evolutionStatus = xpService.checkEvolutionStatus(pokemon);

// Result:
// {
//   canEvolve: true,
//   evolveLevel: 22,
//   ready: false,  // Not level 22 yet
//   nextForm: 26   // Raichu
// }
```

### Execute Evolution

```javascript
const result = xpService.evolvePokemon(pokemon);

// Result:
// {
//   evolved: true,
//   oldPokeId: 25,
//   newPokeId: 26,
//   newStats: {
//     hp: 45,
//     attack: 66,
//     defense: 50
//   }
// }
```

### Award Battle Rewards

```javascript
// Automatically awards XP to both player and all conscious team Pokemon
const result = await xpService.awardBattleRewards(
  walletAddress,
  'pvp',      // Battle type
  15,         // Opponent level
  true        // Won battle
);

// Result:
// {
//   playerXP: 300,
//   playerResult: {
//     leveled: false,
//     newLevel: 5,
//     newXP: 1550,
//     currentXP: 150,
//     nextLevelXP: 2500
//   },
//   pokemonResults: [
//     {
//       uid: "pikachu-1",
//       name: "Pikachu",
//       leveled: true,
//       newLevel: 21,
//       evolutionReady: false,
//       newStats: { ... }
//     },
//     ...
//   ]
// }
```

## Level-Up Progression Table

### Player Progression (First 10 Levels)

| Level | Total XP Needed | XP for Next Level |
|-------|----------------|------------------|
| 1 | 0 | 100 |
| 2 | 100 | 400 |
| 3 | 500 | 900 |
| 4 | 1,400 | 1,600 |
| 5 | 3,000 | 2,500 |
| 6 | 5,500 | 3,600 |
| 7 | 9,100 | 4,900 |
| 8 | 14,000 | 6,400 |
| 9 | 20,400 | 8,100 |
| 10 | 28,500 | 10,000 |

### Pokemon Progression (First 10 Levels)

| Level | Total XP Needed | XP for Next Level |
|-------|----------------|------------------|
| 1 | 0 | 50 |
| 2 | 50 | 200 |
| 3 | 250 | 450 |
| 4 | 700 | 800 |
| 5 | 1,500 | 1,250 |
| 6 | 2,750 | 1,800 |
| 7 | 4,550 | 2,450 |
| 8 | 7,000 | 3,200 |
| 9 | 10,200 | 4,050 |
| 10 | 14,250 | 5,000 |

## Testing XP System

### Test Award XP Endpoint

```bash
curl -X POST http://localhost:4000/api/battle/xp/test-award \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET",
    "xp": 500
  }'
```

### Get Player XP

```bash
curl http://localhost:4000/api/battle/xp/player/YOUR_WALLET
```

## Configuration

To adjust XP curves, modify constants in `services/xpService.js`:

```javascript
// Increase XP requirements (harder to level)
const PLAYER_XP_BASE = 150;  // Default: 100
const POKEMON_XP_BASE = 75;  // Default: 50

// Adjust stat gains per level
const STAT_INCREASE = {
  hp: 4,      // Default: 3
  attack: 3,  // Default: 2
  defense: 3, // Default: 2
  speed: 2,   // Default: 1
};

// Modify XP rewards
function calculateXPReward(battleType, opponentLevel, won) {
  const baseXP = opponentLevel * 15;  // Default: 10
  // ... rest of function
}
```

## Notes

1. **Evolution is Manual**: Pokemon become "evolution ready" but don't auto-evolve. Players must trigger evolution.
2. **Team XP Distribution**: All conscious Pokemon in the team receive XP after battle.
3. **XP Loss**: Currently not implemented, but can be added for high-stakes battles.
4. **XP Sharing**: Future enhancement to split XP among participating Pokemon only.
5. **Effort Values (EVs)**: Not yet implemented but can be added for competitive play.

## Future Enhancements

1. **EV System**: Track effort values for competitive stat growth
2. **Nature System**: Add Pokemon natures that boost/reduce stats
3. **Experience Share**: Toggle XP sharing among team members
4. **Lucky Eggs**: Items that boost XP gain
5. **Experience Catch**: Catch bonuses and critical captures
6. **Held Items**: Exp. Share, Lucky Egg as held items
