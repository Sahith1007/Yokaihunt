import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import ActiveTrainer from '../models/ActiveTrainer.js';
import { isMongoConnected } from '../db.js';
import { getZoneId, getAdjacentZones } from '../utils/zoneUtils.js';

const router = express.Router();
const state = new Map(); // wallet -> { zoneId, data }
const zoneSpawns = new Map(); // zoneId -> spawns[]
const rateLimit = new Map(); // Simple rate limiting: wallet -> last request time

// Simple rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const wallet = req.body?.walletAddress || req.headers['x-wallet-address'];
  if (!wallet) return next();
  
  const now = Date.now();
  const lastRequest = rateLimit.get(wallet) || 0;
  const minInterval = 1000; // 1 second minimum between requests
  
  if (now - lastRequest < minInterval) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  rateLimit.set(wallet, now);
  next();
}

let io;
function initSocketIo(httpServer) {
  if (io) return io;
  io = new SocketIOServer(httpServer, { 
    cors: { 
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    } 
  });
  
  io.on('connection', (socket) => {
    let currentZone = null;
    let walletAddress = null;
    
    // Join zone based on initial position
    socket.on('joinZone', (data) => {
      const { wallet, x, y, name, level, biome } = data || {};
      if (!wallet || x === undefined || y === undefined) return;
      
      walletAddress = wallet;
      const newZone = getZoneId(x, y);
      
      // Leave old zone if different
      if (currentZone && currentZone !== newZone) {
        socket.leave(currentZone);
        // Also leave adjacent zones
        getAdjacentZones(currentZone).forEach(z => socket.leave(z));
      }
      
      // Join new zone and adjacent zones (for cross-zone visibility)
      currentZone = newZone;
      const zonesToJoin = getAdjacentZones(newZone);
      zonesToJoin.forEach(zone => socket.join(zone));
      
      // Store player state
      const pres = {
        walletAddress: wallet,
        zoneId: newZone,
        x: Number(x),
        y: Number(y),
        biome: biome || 'grassland',
        name: name || wallet.slice(0, 6),
        level: Number(level || 1),
        lastUpdate: Date.now()
      };
      
      state.set(wallet, pres);
      
      // Notify others in zone
      socket.to(newZone).emit('playerJoined', {
        wallet,
        x: pres.x,
        y: pres.y,
        name: pres.name,
        level: pres.level,
        biome: pres.biome
      });
      
      // Send current players in zone to new player
      const playersInZone = Array.from(state.values())
        .filter(p => p.zoneId === newZone && p.walletAddress !== wallet)
        .map(p => ({
          wallet: p.walletAddress,
          x: p.x,
          y: p.y,
          name: p.name,
          level: p.level,
          biome: p.biome
        }));
      
      socket.emit('zonePlayers', playersInZone);
      
      // Send zone spawns
      const spawns = zoneSpawns.get(newZone) || [];
      socket.emit('zoneSpawns', spawns);
    });
    
    // Update position (may trigger zone change)
    socket.on('presence', async (data) => {
      const { walletAddress: wallet, x, y, name, level, biome } = data || {};
      if (!wallet || x === undefined || y === undefined) return;
      
      walletAddress = wallet;
      const newZone = getZoneId(x, y);
      
      // Check if zone changed
      const existing = state.get(wallet);
      if (existing && existing.zoneId !== newZone) {
        // Zone transition
        socket.leave(existing.zoneId);
        getAdjacentZones(existing.zoneId).forEach(z => socket.leave(z));
        
        socket.join(newZone);
        getAdjacentZones(newZone).forEach(z => socket.join(z));
        
        // Notify old zone
        socket.to(existing.zoneId).emit('playerLeft', { wallet });
        // Notify new zone
        socket.to(newZone).emit('playerJoined', {
          wallet,
          x: Number(x),
          y: Number(y),
          name: name || wallet.slice(0, 6),
          level: Number(level || 1),
          biome: biome || 'grassland'
        });
      }
      
      const pres = {
        walletAddress: wallet,
        zoneId: newZone,
        x: Number(x),
        y: Number(y),
        biome: biome || 'grassland',
        name: name || wallet.slice(0, 6),
        level: Number(level || 1),
        lastUpdate: Date.now()
      };
      
      state.set(wallet, pres);
      currentZone = newZone;
      
      // Broadcast to zone (excluding sender)
      socket.to(newZone).emit('playerUpdate', {
        wallet,
        x: pres.x,
        y: pres.y,
        name: pres.name,
        level: pres.level
      });
      
      // Persist to database
      if (isMongoConnected()) {
        try {
          await ActiveTrainer.findOneAndUpdate(
            { walletAddress: wallet },
            { $set: { username: pres.name, x: Math.floor(pres.x / 32), y: Math.floor(pres.y / 32), biome: pres.biome, level: pres.level, lastActive: new Date() } },
            { upsert: true }
          );
        } catch {}
      }
    });
    
    socket.on('disconnect', () => {
      if (walletAddress && currentZone) {
        // Notify zone that player left
        socket.to(currentZone).emit('playerLeft', { wallet: walletAddress });
        state.delete(walletAddress);
      }
    });
  });
  
  // Cleanup expired players every 5 seconds
  setInterval(() => {
    const now = Date.now();
    const EXPIRY_MS = 10000; // 10 seconds
    const expired = [];
    
    for (const [wallet, pres] of state.entries()) {
      if (now - pres.lastUpdate > EXPIRY_MS) {
        expired.push({ wallet, zoneId: pres.zoneId });
        state.delete(wallet);
      }
    }
    
    // Notify zones of expired players
    expired.forEach(({ wallet, zoneId }) => {
      if (io) {
        io.to(zoneId).emit('playerLeft', { wallet });
      }
    });
  }, 5000);
  
  return io;
}

router.post('/multiplayer/update', rateLimitMiddleware, async (req, res) => {
  const { walletAddress, x, y, biome, name, level } = req.body || {};
  if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
  
  const zoneId = getZoneId(x, y);
  const pres = {
    walletAddress,
    zoneId,
    x: Number(x || 0),
    y: Number(y || 0),
    biome: biome || 'grassland',
    name: name || walletAddress.slice(0, 6),
    level: Number(level || 1),
    lastUpdate: Date.now()
  };
  
  state.set(walletAddress, pres);
  
  if (isMongoConnected()) {
    try {
      await ActiveTrainer.findOneAndUpdate(
        { walletAddress },
        { $set: { username: pres.name, x: Math.floor(pres.x / 32), y: Math.floor(pres.y / 32), biome: pres.biome, level: pres.level, lastActive: new Date() } },
        { upsert: true }
      );
    } catch {}
  }
  
  return res.json({ success: true, zoneId });
});

router.get('/multiplayer/active', (req, res) => {
  const { zoneId } = req.query || {};
  const now = Date.now();
  const EXPIRY_MS = 10000; // 10 seconds
  
  let players = Array.from(state.values())
    .filter(p => now - p.lastUpdate < EXPIRY_MS);
  
  // Filter by zone if provided
  if (zoneId) {
    players = players.filter(p => p.zoneId === zoneId);
  }
  
  const list = players.map(p => ({
    wallet: p.walletAddress,
    walletAddress: p.walletAddress,
    x: p.x,
    y: p.y,
    biome: p.biome,
    name: p.name,
    level: p.level || 1,
    zoneId: p.zoneId,
    lastUpdate: p.lastUpdate
  }));
  
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-wallet-address');
  
  return res.json({ players: list });
});

// Zone spawn management
router.post('/multiplayer/zone/spawns', (req, res) => {
  const { zoneId, spawns } = req.body || {};
  if (!zoneId || !Array.isArray(spawns)) {
    return res.status(400).json({ error: 'zoneId and spawns array required' });
  }
  
  zoneSpawns.set(zoneId, spawns);
  
  // Broadcast to all players in zone
  if (io) {
    io.to(zoneId).emit('zoneSpawns', spawns);
  }
  
  return res.json({ success: true });
});

router.get('/multiplayer/zone/spawns', (req, res) => {
  const { zoneId } = req.query || {};
  if (!zoneId) {
    return res.status(400).json({ error: 'zoneId required' });
  }
  
  const spawns = zoneSpawns.get(zoneId) || [];
  return res.json({ spawns });
});

export { initSocketIo };
export default router;