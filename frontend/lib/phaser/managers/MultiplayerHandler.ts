// frontend/lib/phaser/managers/MultiplayerHandler.ts

import { io, Socket } from "socket.io-client";

export default class MultiplayerHandler {
  private socket: Socket;
  private lastMoveSent = 0;

  constructor() {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    this.socket = io(url);

    this.socket.on("connect", () => {
      console.log("Connected to multiplayer server");
    });
  }

  joinGame(wallet: string, x: number, y: number, biome: string) {
    this.socket.emit("join", { wallet, x, y, biome });
  }

  sendPosition(wallet: string, x: number, y: number, biome: string, dir: number) {
    const now = Date.now();
    if (now - this.lastMoveSent < 200) return; // rate-limit

    this.lastMoveSent = now;
    this.socket.emit("move", { wallet, x, y, biome, dir });
  }

  onPlayersUpdate(cb: (players: any) => void) {
    this.socket.on("playersUpdate", cb);
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
  }
}
