# Battle System Documentation

## Overview

The YokaiHunt battle system provides server-side validation for PVP and Gym battles, ensuring fair matchmaking and accurate XP progression. Wild battles remain client-driven for performance.

## Architecture

### Components

1. **BattleSession Model** (`models/BattleSession.js`)
   - Stores complete battle state
   - Maintains action log for replay
   - Tracks rewards and winners

2. **Battle Engine** (`services/battleEngine.js`)
   - Deterministic battle simulation
   - Seeded randomness for reproducibility
   - Damage calculation using Pokemon formulas

3. **XP Service** (`services/xpService.js`)
   - XP calculation and level-ups
   - Evolution triggers
   - Stat increases

4. **Battle Routes** (`routes/battle.js`)
   - API endpoints for battle management
   - Session creation and validation
   - Reward distribution

## Battle Types

### Wild Battles (Client-Side)
- Fast, local battles for casual gameplay
- No server validation required
- Use legacy endpoints: `/api/battle/start` and `/api/battle/resolve`

### Gym Battles (Server-Validated)
- Server creates predefined gym teams
- Can be auto-resolved or manually played
- Awards gym-specific XP and badges

### PVP Battles (Server-Validated)
- Fully server-validated with action signatures
- Real-time or turn-based gameplay
- Double XP rewards

## API Endpoints

### Create Battle Session
```bash
POST /api/battle/create
Headers: x-wallet-address: <wallet>
Body: {
  "type": "pvp" | "gym",
  "opponent": "<wallet_address>",  # Required for PVP
  "seed": "<optional_seed>"
}

Response: {
  "success": true,
  "sessionId": "uuid",
  "seed": "random_seed",
  "players": [...]
}
```

### Submit Battle Action
```bash
POST /api/battle/action
Headers: x-wallet-address: <wallet>
Body: {
  "sessionId": "uuid",
  "action": {
    "actorUid": "pokemon_uid",
    "moveId": "tackle",
    "targetUid": "optional_target"
  },
  "signature": "optional_signature"
}

Response: {
  "success": true,
  "battleOver": false,
  "winner": null,
  "action": {
    "turn": 0,
    "damage": 15,
    "accuracy": true
  }
}
```

### Get Battle Session
```bash
GET /api/battle/session/:sessionId

Response: {
  "success": true,
  "session": { ... }
}
```

### Finish Battle (Award Rewards)
```bash
POST /api/battle/finish
Headers: x-wallet-address: <wallet>
Body: {
  "sessionId": "uuid"
}

Response: {
  "success": true,
  "winner": "<wallet>",
  "rewards": {
    "winner": {
      "playerXP": 200,
      "pokemonXP": 200
    },
    "loser": {
      "playerXP": 60,
      "pokemonXP": 60
    }
  }
}
```

### Auto-Resolve (Gym Only)
```bash
POST /api/battle/auto-resolve
Body: {
  "sessionId": "uuid"
}

Response: {
  "success": true,
  "winner": "<wallet>",
  "turns": 15
}
```

### Replay Battle (Verification)
```bash
GET /api/battle/replay/:sessionId

Response: {
  "success": true,
  "allMatch": true,
  "replayResults": [...]
}
```

## Battle Flow

### PVP Battle Example

1. **Player A creates battle:**
```bash
curl -X POST http://localhost:4000/api/battle/create \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: WALLET_A" \
  -d '{"type":"pvp","opponent":"WALLET_B"}'
```

2. **Both players submit actions:**
```bash
# Player A attacks
curl -X POST http://localhost:4000/api/battle/action \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: WALLET_A" \
  -d '{
    "sessionId":"SESSION_ID",
    "action":{"actorUid":"pikachu-1","moveId":"thunderShock"}
  }'

# Player B attacks
curl -X POST http://localhost:4000/api/battle/action \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: WALLET_B" \
  -d '{
    "sessionId":"SESSION_ID",
    "action":{"actorUid":"bulbasaur-1","moveId":"tackle"}
  }'
```

3. **Repeat until battle ends (battleOver: true)**

4. **Award rewards:**
```bash
curl -X POST http://localhost:4000/api/battle/finish \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: WALLET_A" \
  -d '{"sessionId":"SESSION_ID"}'
```

### Gym Battle Example

1. **Create gym battle:**
```bash
curl -X POST http://localhost:4000/api/battle/create \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: WALLET" \
  -d '{"type":"gym","opponent":"brock"}'
```

2. **Auto-resolve:**
```bash
curl -X POST http://localhost:4000/api/battle/auto-resolve \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID"}'
```

3. **Get rewards:**
```bash
curl -X POST http://localhost:4000/api/battle/finish \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID"}'
```

## Damage Formula

The battle engine uses the classic Pokemon damage formula:

```
damage = floor(((2 * level / 5 + 2) * attack * power) / (defense * 50)) + 2
```

With random variance (85-100%):
```
final_damage = damage * (0.85 + random(0, 0.15))
```

## Determinism

All battles are deterministic based on:
- **Seed**: Random seed generated on session creation
- **Turn**: Current turn number
- **Actions**: Ordered sequence of actions

This allows:
- Exact replay of any battle
- Dispute resolution
- Anti-cheat verification

## Anti-Cheat

1. **Action Signatures**: PVP actions require wallet signatures
2. **Server Validation**: All damage calculations are server-side
3. **Replay System**: Can verify any battle's legitimacy
4. **Action Logs**: Complete history stored in database

## Testing

Run the smoke test suite:
```bash
cd backend
node scripts/test-battle-system.js
```

Tests include:
- XP calculation accuracy
- Battle creation and management
- Deterministic replay
- Auto-resolve functionality

## Performance Considerations

- **Wild Battles**: Keep client-side for fast response
- **Gym Battles**: Can be cached or pre-simulated
- **PVP Battles**: Use websockets for real-time play (future enhancement)
- **Session Cleanup**: Implement TTL for old sessions

## Future Enhancements

1. **Type effectiveness**: Add type matchups (fire vs water, etc.)
2. **Status effects**: Implement poison, paralysis, sleep
3. **Weather**: Add weather effects and abilities
4. **Items**: Support battle items (potions, buffs)
5. **Spectator mode**: Allow watching live PVP battles
6. **Tournaments**: Bracket-style competitions
