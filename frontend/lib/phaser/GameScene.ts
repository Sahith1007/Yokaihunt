import * as Phaser from "phaser";
import { io, type Socket } from "socket.io-client";

export interface SceneConfig {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  playerSpeed: number;
  initialX?: number;
  initialY?: number;
}

export class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private configData: SceneConfig = {
    tileSize: 32,
    mapWidth: 50,
    mapHeight: 38,
    playerSpeed: 200,
  };
  private playerSpeed = 200;
  private socket?: Socket;
  private myId?: string;
  private others: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private lastSent = 0;

  constructor() {
    super("GameScene");
  }

  init(data: Partial<SceneConfig>) {
    this.configData = { ...this.configData, ...data } as SceneConfig;
    if (this.configData.playerSpeed)
      this.playerSpeed = this.configData.playerSpeed;
  }

  preload() {
    // Generate a simple 2-tile spritesheet (grass, wall) programmatically
    const { tileSize } = this.configData;
    const width = tileSize * 2;
    const height = tileSize;
    const sheet = this.textures.createCanvas("tilesheet", width, height);
    if (!sheet) {
      throw new Error("Failed to create canvas texture 'tilesheet'");
    }
    const ctx = sheet.getContext();
    if (!ctx) {
      throw new Error("Failed to get 2D rendering context from canvas 'tilesheet'");
    }

    // Grass tile (index 0)
    ctx.fillStyle = "#2d6a4f";
    ctx.fillRect(0, 0, tileSize, tileSize);
    // sprinkle dots
    ctx.fillStyle = "#40916c";
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * (tileSize - 2);
      const y = Math.random() * (tileSize - 2);
      ctx.fillRect(x, y, 2, 2);
    }

    // Wall tile (index 1)
    ctx.fillStyle = "#6c757d";
    ctx.fillRect(tileSize, 0, tileSize, tileSize);
    ctx.strokeStyle = "#495057";
    for (let i = 0; i < tileSize; i += 4) {
      ctx.beginPath();
      ctx.moveTo(tileSize, i + 0.5);
      ctx.lineTo(tileSize * 2, i + 0.5);
      ctx.stroke();
    }

    sheet.refresh();

    // Generate a player texture (circle)
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffd166, 1);
    g.fillCircle(tileSize / 2, tileSize / 2, tileSize * 0.4);
    g.lineStyle(2, 0x073b4c, 1);
    g.strokeCircle(tileSize / 2, tileSize / 2, tileSize * 0.4);
    g.generateTexture("player", tileSize, tileSize);
    g.destroy();
  }

  create() {
    const { tileSize, mapWidth, mapHeight } = this.configData;

    // Create a blank tilemap and a dynamic layer using our generated spritesheet
    const map = this.make.tilemap({
      tileWidth: tileSize,
      tileHeight: tileSize,
      width: mapWidth,
      height: mapHeight,
    });
    const tileset = map.addTilesetImage(
      "tiles",
      "tilesheet",
      tileSize,
      tileSize,
      0,
      0,
    );
    if (!tileset) throw new Error("Failed to create tileset from tilesheet");
    const layer = map.createBlankLayer("ground", tileset, 0, 0);
    if (!layer) throw new Error("Failed to create blank ground layer");
    this.groundLayer = layer;

    // Fill ground (index 0) and carve walls (index 1) along the border + a few random obstacles
    this.groundLayer.fill(0, 0, 0, mapWidth, mapHeight);
    for (let x = 0; x < mapWidth; x++) {
      this.groundLayer.putTileAt(1, x, 0);
      this.groundLayer.putTileAt(1, x, mapHeight - 1);
    }
    for (let y = 0; y < mapHeight; y++) {
      this.groundLayer.putTileAt(1, 0, y);
      this.groundLayer.putTileAt(1, mapWidth - 1, y);
    }
    // random obstacles
    for (let i = 0; i < Math.floor(mapWidth * mapHeight * 0.05); i++) {
      const rx = Phaser.Math.Between(1, mapWidth - 2);
      const ry = Phaser.Math.Between(1, mapHeight - 2);
      this.groundLayer.putTileAt(1, rx, ry);
    }

    // Enable collisions for wall tiles (index 1)
    this.groundLayer.setCollision(1, true);

    // Player setup
    const startX = this.configData.initialX ?? tileSize * 2;
    const startY = this.configData.initialY ?? tileSize * 2;
    this.player = this.physics.add.sprite(startX, startY, "player");
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    // Camera and world bounds
    const worldWidth = mapWidth * tileSize;
    const worldHeight = mapHeight * tileSize;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Collide player with walls
    this.physics.add.collider(this.player, this.groundLayer);

    // Input
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | undefined;

    // Multiplayer socket
    this.initMultiplayer();
  }

  update() {
    if (!this.player || !this.player.body) return;

    const speed: number = this.playerSpeed;
    let vx = 0;
    let vy = 0;

    // Arrow keys
    if (this.cursors?.left?.isDown) vx -= 1;
    if (this.cursors?.right?.isDown) vx += 1;
    if (this.cursors?.up?.isDown) vy -= 1;
    if (this.cursors?.down?.isDown) vy += 1;

    // WASD
    if (this.wasd?.A?.isDown) vx -= 1;
    if (this.wasd?.D?.isDown) vx += 1;
    if (this.wasd?.W?.isDown) vy -= 1;
    if (this.wasd?.S?.isDown) vy += 1;

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (vx === 0 && vy === 0) {
      body.setVelocity(0, 0);
    } else {
      const len = Math.hypot(vx, vy) || 1;
      body.setVelocity((vx / len) * speed, (vy / len) * speed);
    }

    // Throttled position sync
    const now = this.time.now;
    if (this.socket && now - this.lastSent > 100) {
      this.socket.emit("move", { x: this.player.x, y: this.player.y });
      this.lastSent = now;
    }
  }

  private initMultiplayer() {
    if (this.socket) return; // already connected

    const socket = io("http://localhost:4000", {
      transports: ["websocket"],
      autoConnect: true,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.myId = socket.id;
    });

    socket.on(
      "initState",
      (payload: { players: Record<string, { x: number; y: number }> }) => {
        // Create sprites for existing players (excluding self)
        Object.entries(payload.players).forEach(([id, pos]) => {
          if (id === this.myId) return;
          this.spawnOther(id, pos.x, pos.y);
        });
      },
    );

    socket.on(
      "playerJoined",
      ({ id, x, y }: { id: string; x: number; y: number }) => {
        if (id === this.myId) return;
        this.spawnOther(id, x, y);
      },
    );

    socket.on(
      "playerMoved",
      ({ id, x, y }: { id: string; x: number; y: number }) => {
        const sprite = this.others.get(id);
        if (sprite) {
          sprite.x = x;
          sprite.y = y;
        }
      },
    );

    socket.on("playerLeft", ({ id }: { id: string }) => {
      const sprite = this.others.get(id);
      if (sprite) {
        sprite.destroy();
        this.others.delete(id);
      }
    });

    // Cleanup on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      socket.removeAllListeners();
      socket.disconnect();
      this.socket = undefined;
      this.myId = undefined;
      this.others.forEach((s) => {
        s.destroy();
      });
      this.others.clear();
    });
  }

  private spawnOther(id: string, x: number, y: number) {
    const s = this.add.sprite(x, y, "player").setTint(0x118ab2);
    s.setDepth(5);
    this.others.set(id, s);
  }
}
