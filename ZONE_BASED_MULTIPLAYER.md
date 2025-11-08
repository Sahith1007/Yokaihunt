# Zone-Based Multiplayer System

## Overview

The YokaiHunt multiplayer system uses **region-based segmentation** to handle 50+ concurrent players efficiently. The map is divided into zones (10x10 tile chunks), and players only receive updates from their current zone and adjacent zones.

## Architecture

### Zone System

- **Zone Size**: 10x10 tiles = 320x320 pixels (at 32px/tile)
- **Zone ID Format**: `zone_X_Y` (e.g., `zone_3_4`)
- **Zone Calculation**: Based on world coordinates (x, y) → tile coordinates → zone coordinates

### Backend (Socket.io + Express)

**File**: `backend/routes/multiplayer.js`

- **Socket.io Rooms**: Each zone is a Socket.io room
- **Zone Transitions**: Players automatically leave old zone and join new zone when moving
- **Adjacent Zones**: Players join current zone + 8 adjacent zones for cross-zone visibility
- **State Management**: 
  - `state` Map: `wallet → { zoneId, x, y, name, level, biome, lastUpdate }`
  - `zoneSpawns` Map: `zoneId → spawns[]`
- **Auto-Expiry**: Players inactive for 10+ seconds are removed

**Key Events**:
- `joinZone` - Initial zone join with player data
- `presence` - Position updates (triggers zone change if needed)
- `playerJoined` - Broadcast to zone when player enters
- `playerLeft` - Broadcast to zone when player leaves
- `playerUpdate` - Position updates within zone
- `zoneSpawns` - Spawn synchronization for zone

### Frontend (Phaser + React)

**Files**:
- `frontend/lib/utils/zoneUtils.ts` - Zone calculation utilities
- `frontend/lib/phaser/managers/MultiplayerHandler.ts` - Zone-aware multiplayer handler
- `frontend/lib/phaser/GameScene.ts` - Zone transition handling

**Features**:
- Automatic zone detection on movement
- Zone change callbacks with spawn cleanup
- Smooth player interpolation within zones
- Zone-based spawn synchronization

### Spawn Synchronization

**File**: `backend/routes/spawn.js`

- **Per-Zone Spawns**: Each zone maintains its own spawn cache
- **Spawn Generation**: 3-8 Pokémon per zone, regenerated every 30 seconds
- **Zone Bounds**: Spawns are generated within zone boundaries
- **Cache Management**: Keeps last 50 active zones in memory

## How It Works

### 1. Player Joins

```
Player connects → Socket.io connection
Player sends position → Calculate zoneId
Socket joins zone room → Receive zone players + spawns
```

### 2. Player Moves

```
Position update every 2 seconds
Check if zone changed
  → Yes: Leave old zone, join new zone
  → Broadcast to new zone
  → Cleanup old zone spawns
  → Request new zone spawns
```

### 3. Zone Transitions

```
Old Zone: zone_3_4
New Zone: zone_4_4

Actions:
1. socket.leave('zone_3_4')
2. socket.leave(adjacent zones of 3,4)
3. socket.join('zone_4_4')
4. socket.join(adjacent zones of 4,4)
5. Broadcast 'playerLeft' to old zone
6. Broadcast 'playerJoined' to new zone
7. Send zone spawns to player
```

### 4. Spawn Management

```
Backend maintains: zoneSpawns Map
Key: zoneId (e.g., "zone_3_4")
Value: Array of spawn objects

When player enters zone:
→ GET /api/spawn/sync?zoneId=zone_3_4
→ Backend returns spawns for that zone
→ Frontend renders spawns with glowing circles

When spawns update:
→ POST /api/multiplayer/zone/spawns
→ Broadcast to all players in zone via Socket.io
```

## Scalability Benefits

### Memory Efficiency

- **Before**: All players in single state → O(n²) updates
- **After**: Players segmented by zone → O(n) per zone
- **Example**: 50 players across 10 zones = 5 players/zone average

### Network Efficiency

- **Before**: Broadcast to all 50 players
- **After**: Broadcast only to players in same zone (5-10 players)
- **Bandwidth Reduction**: ~80-90% less traffic

### Spawn Management

- **Before**: Global spawn pool, conflicts when multiple players catch
- **After**: Per-zone spawn pools, synchronized within zone
- **Result**: No spawn conflicts, predictable spawn behavior

## Testing Checklist

✅ **Zone Calculation**
- [ ] Player at (0, 0) → zone_0_0
- [ ] Player at (320, 320) → zone_1_1
- [ ] Player at (640, 640) → zone_2_2

✅ **Zone Transitions**
- [ ] Move from zone_0_0 to zone_1_0
- [ ] Verify old zone players disappear
- [ ] Verify new zone players appear
- [ ] Verify spawns update

✅ **Multiplayer Sync**
- [ ] Two browsers in same zone → see each other
- [ ] Two browsers in different zones → don't see each other
- [ ] Move to same zone → see each other appear
- [ ] Movement interpolation is smooth

✅ **Spawn Synchronization**
- [ ] Two players in same zone see same spawns
- [ ] Spawns persist when moving within zone
- [ ] Spawns change when entering new zone
- [ ] Spawns cleanup when leaving zone

## Deployment Notes

### Backend Scaling

1. **Single Server**: Works for <100 concurrent players
2. **Multiple Servers**: Use Redis adapter for Socket.io
   ```javascript
   const redisAdapter = require('@socket.io/redis-adapter');
   io.adapter(redisAdapter(redisClient, redisClient.duplicate()));
   ```
3. **Redis for State**: Move `state` and `zoneSpawns` to Redis
   - Use Redis TTL for auto-expiry
   - Use Redis pub/sub for cross-server updates

### Frontend Scaling

- **CDN**: Static assets (maps, sprites) via Vercel/Netlify CDN
- **WebSocket**: Connect to backend domain (wss:// for production)
- **Fallback**: HTTP polling if WebSocket fails

## Future Enhancements

1. **Redis Integration**: Move state to Redis for multi-server support
2. **Zone Preloading**: Preload adjacent zones for smoother transitions
3. **Spawn Persistence**: Store spawns in database for consistency
4. **Zone Analytics**: Track player density per zone
5. **Dynamic Zone Sizing**: Adjust zone size based on player density

