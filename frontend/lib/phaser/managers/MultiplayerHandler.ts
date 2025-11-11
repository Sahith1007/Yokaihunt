// frontend/lib/phaser/managers/MultiplayerHandler.ts

import { io, Socket } from "socket.io-client";

export default class MultiplayerHandler {
  private socket: Socket;
  private lastSent = 0;

  constructor() {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    this.socket = io(url);
  }

  // No rooms, no join step required in minimal API
  joinGame(_wallet: string, _x: number, _y: number, _biome: string) {}

  sendPosition(wallet: string, x: number, y: number) {
    const now = Date.now();
    if (now - this.lastSent < 1500) return; // emit every 1500 ms
    this.lastSent = now;
    this.socket.emit("player:update", { wallet, x, y });
  }

  onPlayersUpdate(cb: (players: any) => void) {
    this.socket.on("players:update", cb);
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
  }
}
