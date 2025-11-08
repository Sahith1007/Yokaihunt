// backend/socket/index.js

import { Server } from "socket.io";

let activePlayers = {};   // wallet → player state

export default function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // When player joins game
    socket.on("join", (data) => {
      const { wallet, x, y, biome, dir } = data;
      activePlayers[wallet] = {
        wallet,
        x,
        y,
        biome,
        dir: dir || 0,
        lastActive: Date.now(),
        socketId: socket.id
      };

      socket.join("world");
      console.log(`Player ${wallet} joined world`);
    });

    // Movement updates
    socket.on("move", (data) => {
      const { wallet, x, y, biome, dir } = data;
      if (!activePlayers[wallet]) return;

      activePlayers[wallet].x = x;
      activePlayers[wallet].y = y;
      activePlayers[wallet].biome = biome;
      activePlayers[wallet].dir = dir;
      activePlayers[wallet].lastActive = Date.now();
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      for (const w in activePlayers) {
        if (activePlayers[w].socketId === socket.id) {
          delete activePlayers[w];
          console.log("Removed player:", w);
        }
      }
    });
  });

  // Broadcast every 150ms
  setInterval(() => {
    io.to("world").emit("playersUpdate", activePlayers);

    // Remove inactive players
    const now = Date.now();
    for (const w in activePlayers) {
      if (now - activePlayers[w].lastActive > 5000) {
        delete activePlayers[w];
      }
    }
  }, 150);

  return io;
};

