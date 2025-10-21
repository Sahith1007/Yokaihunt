const express = require("express");
const http = require("node:http");
const { Server } = require("socket.io");
const { Server: ColyseusServer, matchMaker } = require("colyseus");
const { BattleRoom } = require("./colyseus/BattleRoom");
const { prisma } = require("./prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

// Colyseus server attaches to same HTTP server (WebSocket)
const gameServer = new ColyseusServer({ server });
gameServer.define("battle", BattleRoom);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Simple in-memory cache for PokéAPI responses
// key: pokemon id or name (lowercase) -> value: aggregated payload
const pokemonCache = new Map();

/** @type {Record<string, { x: number; y: number }>} */
const players = {};

// Basic spawn area (tweak to your world size)
const SPAWN_MIN = 64;
const SPAWN_MAX = 512;

// Simple matchmaking queue: clients emit 'queueForBattle' to be paired
const battleQueue = [];

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || "dev_insecure_secret";
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Auth routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) return res.status(409).json({ error: "User exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, hashedPassword },
    });
    await prisma.playerProgress.create({
      data: {
        userId: user.id,
        currentMap: "start",
        posX: 64,
        posY: 64,
        ownedYokai: [],
      },
    });
    const token = signToken({ sub: user.id, username: user.username });
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: "Register failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body || {};
    if (!emailOrUsername || !password)
      return res.status(400).json({ error: "Missing fields" });
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.hashedPassword);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken({ sub: user.id, username: user.username });
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: "Login failed" });
  }
});

// PokéAPI proxy: fetch Pokémon details by id or name, with in-memory cache
app.get("/api/pokemon/:id", async (req, res) => {
  try {
    const keyRaw = (req.params.id || "").toString();
    const key = keyRaw.toLowerCase();
    if (!key) return res.status(400).json({ error: "Missing id or name" });

    if (pokemonCache.has(key)) return res.json(pokemonCache.get(key));

    // Base Pokémon data
    const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`);
    if (!pRes.ok) return res.status(404).json({ error: "Pokémon not found" });
    const p = await pRes.json();

    const payload = {
      id: p.id,
      name: p.name,
      types: (p.types || []).map((t) => t?.type?.name).filter(Boolean),
      stats: (p.stats || []).map((s) => ({ name: s?.stat?.name, value: s?.base_stat })).filter((x) => x.name != null),
      sprite: p?.sprites?.front_default || null,
      height: p.height,
      weight: p.weight,
      evolution_chain: null,
    };

    // Fetch species to get evolution chain URL
    if (p?.species?.url) {
      try {
        const sRes = await fetch(p.species.url);
        if (sRes.ok) {
          const species = await sRes.json();
          if (species?.evolution_chain?.url) {
            const eRes = await fetch(species.evolution_chain.url);
            if (eRes.ok) payload.evolution_chain = await eRes.json();
          }
        }
      } catch {
        // ignore evo chain errors; keep other data
      }
    }

    // Cache by both id and name for future hits
    pokemonCache.set(String(payload.id), payload);
    pokemonCache.set(String(payload.name).toLowerCase(), payload);

    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch Pokémon" });
  }
});

// Player progress endpoints
app.get("/api/player", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const progress = await prisma.playerProgress.findUnique({
      where: { userId },
    });
    return res.json({ progress });
  } catch (e) {
    return res.status(500).json({ error: "Failed to load progress" });
  }
});
app.post("/api/player", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { currentMap, posX, posY, ownedYokai } = req.body || {};
    const data = {};
    if (typeof currentMap === "string") data.currentMap = currentMap;
    if (Number.isFinite(posX)) data.posX = Math.trunc(posX);
    if (Number.isFinite(posY)) data.posY = Math.trunc(posY);
    if (ownedYokai !== undefined) data.ownedYokai = ownedYokai;
    const progress = await prisma.playerProgress.update({
      where: { userId },
      data,
    });
    return res.json({ progress });
  } catch (e) {
    return res.status(500).json({ error: "Failed to save progress" });
  }
});

io.on("connection", (socket) => {
  const id = socket.id;
  const spawn = {
    x: Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN)) + SPAWN_MIN,
    y: Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN)) + SPAWN_MIN,
  };

  // Send current state to the new client
  socket.emit("initState", { players });

  // Add and broadcast new player
  players[id] = spawn;
  socket.broadcast.emit("playerJoined", { id, ...spawn });

  // Movement updates from this client
  socket.on("move", (pos) => {
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
    players[id] = { x: pos.x, y: pos.y };
    socket.broadcast.emit("playerMoved", { id, x: pos.x, y: pos.y });
  });

  // Opt-in matchmaking
  socket.on("queueForBattle", async () => {
    if (battleQueue.find((s) => s.id === socket.id)) return;
    battleQueue.push(socket);
    if (battleQueue.length >= 2) {
      const s1 = battleQueue.shift();
      const s2 = battleQueue.shift();
      try {
        const room = await matchMaker.createRoom("battle", {});
        const res1 = await matchMaker.reserveSeatFor(room, { id: s1.id });
        const res2 = await matchMaker.reserveSeatFor(room, { id: s2.id });
        s1.emit("battleFound", {
          endpoint: `ws://localhost:${PORT}`,
          reservation: res1,
        });
        s2.emit("battleFound", {
          endpoint: `ws://localhost:${PORT}`,
          reservation: res2,
        });
      } catch (err) {
        const msg = err?.message || "Failed to create battle room";
        s1?.emit("battleError", { message: msg });
        s2?.emit("battleError", { message: msg });
      }
    }
  });

  socket.on("disconnect", () => {
    delete players[id];
    socket.broadcast.emit("playerLeft", { id });
    // Remove from queue if present
    const idx = battleQueue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) battleQueue.splice(idx, 1);
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
