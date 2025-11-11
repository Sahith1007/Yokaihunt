// backend/socket/index.js

import { Server } from "socket.io";

// wallet -> { x, y, lastSeen }
let globalPlayers = {};

export default function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    // Minimal API: client only sends periodic updates
    socket.on("player:update", (payload) => {
      const { wallet, x, y } = payload || {};
      if (!wallet || typeof x !== "number" || typeof y !== "number") return;
      globalPlayers[wallet] = { x, y, lastSeen: Date.now() };
    });

    socket.on("disconnect", () => {
      // best-effort cleanup by socket id is intentionally omitted in minimal API
    });
  });

  // Broadcast world snapshot every ~1.5s and cleanup stale players (>10s)
  setInterval(() => {
    // cleanup
    const now = Date.now();
    for (const w in globalPlayers) {
      if (now - (globalPlayers[w]?.lastSeen || 0) > 10000) delete globalPlayers[w];
    }
    io.emit("players:update", globalPlayers);
  }, 1500);

  return io;
};

