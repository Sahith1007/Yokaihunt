import * as Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import { catchPokemon as apiCatch } from "../api/api";

function capitalize(s: string) {
  return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
}

export interface SceneConfig {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  playerSpeed: number;
  initialX?: number;
  initialY?: number;
  onPokemonSpotted?: (pokemon: { name: string; spriteUrl: string; pokeId: number }) => void;
  onPokemonCleared?: () => void;
  playerPokemon?: any; // Selected Pokémon for battle
}

type SpawnRecord = {
  key: string;
  name: string;
  pokeId: number;
  data: any;
  sprite: Phaser.GameObjects.Image | null;
  position: { x: number; y: number };
  spriteUrl: string;
};

export class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private enterKey?: Phaser.Input.Keyboard.Key;
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

  // Spawns on the map
  private spawns: Map<string, SpawnRecord> = new Map();
  private spawnTimer?: Phaser.Time.TimerEvent;

  // UI (sidebar)
  private ui?: Phaser.GameObjects.Container;
  private uiStatus?: Phaser.GameObjects.Text;
  private lastStatusAt = 0;

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
    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Sidebar UI
    this.createSidebarUI();

    // Multiplayer socket (kept from your original)
    this.initMultiplayer();

    // Start spawn loop (first spawn scheduled randomly 10–20s)
    this.scheduleNextSpawn();
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

    // Keep UI pinned
    if (this.ui) this.ui.setScrollFactor(0);

    // Throttled position sync (multiplayer)
    const now = this.time.now;
    if (this.socket && now - this.lastSent > 100) {
      this.socket.emit("move", { x: this.player.x, y: this.player.y });
      this.lastSent = now;
    }

    // Battle when near and Enter pressed
    if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      const nearest = this.getNearestSpawn(48);
      if (nearest) this.startBattle(nearest);
    }
  }

  // ---- Spawn system ----
  private scheduleNextSpawn() {
    const delay = Phaser.Math.Between(3000, 8000); // 3–8s (faster for testing)
    this.spawnTimer?.remove(false);
    this.spawnTimer = this.time.addEvent({ delay, callback: () => this.spawnRandomPokemon(), loop: false });
  }

  private async spawnRandomPokemon() {
    try {
      const pos = this.pickRandomGrassTile();
      if (!pos) { this.scheduleNextSpawn(); return; }

      const pokeId = Phaser.Math.Between(1, 898);
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
      const data = await res.json();
      const spriteUrl = data?.sprites?.front_default || data?.sprites?.other?.["official-artwork"]?.front_default;
      if (!spriteUrl) { this.scheduleNextSpawn(); return; }

      const key = `pkmn-${pokeId}-${Date.now()}`;
      
      // Store pokemon data without creating a sprite on the map
      const rec: SpawnRecord = { 
        key, 
        name: data.name, 
        pokeId, 
        data, 
        sprite: null as any, // No sprite needed
        position: pos,
        spriteUrl
      };
      this.spawns.set(key, rec);
      this.statusOnce(`A wild ${capitalize(data.name)} appeared nearby!`, 600);
      
      // Notify React component if callback provided
      if (this.configData.onPokemonSpotted) {
        this.configData.onPokemonSpotted({
          name: data.name,
          spriteUrl,
          pokeId
        });
      }
    } catch (e) {
      // ignore transient errors
    } finally {
      this.scheduleNextSpawn();
    }
  }

  private pickRandomGrassTile() {
    const { mapWidth, mapHeight, tileSize } = this.configData;
    for (let attempts = 0; attempts < 40; attempts++) {
      const tx = Phaser.Math.Between(1, mapWidth - 2);
      const ty = Phaser.Math.Between(1, mapHeight - 2);
      const t = this.groundLayer.getTileAt(tx, ty);
      if (t && t.index === 0) {
        const px = tx * tileSize + tileSize / 2;
        const py = ty * tileSize + tileSize / 2;
        // avoid spawning too close to player (reduced distance for easier spotting)
        if (Phaser.Math.Distance.Between(px, py, this.player.x, this.player.y) > tileSize * 1.5) {
          return { x: px, y: py };
        }
      }
    }
    return null;
  }

  private getNearestSpawn(radius: number): SpawnRecord | null {
    let nearest: SpawnRecord | null = null;
    let best = Number.POSITIVE_INFINITY;
    this.spawns.forEach((rec) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, rec.position.x, rec.position.y);
      if (d < radius && d < best) { best = d; nearest = rec; }
    });
    return nearest;
  }

  private startBattle(rec: SpawnRecord) {
    if (!this.configData.playerPokemon) {
      this.statusOnce('You need a Pokémon to battle!', 800);
      return;
    }
    
    // Clear from sidebar and map
    this.spawns.delete(rec.key);
    if (this.configData.onPokemonCleared) this.configData.onPokemonCleared();
    
    // Transition to BattleScene
    this.scene.start('BattleScene', {
      wildPokemon: {
        name: rec.name,
        pokeId: rec.pokeId,
        data: rec.data,
        spriteUrl: rec.spriteUrl
      },
      playerPokemon: this.configData.playerPokemon
    });
  }

  // ---- UI helpers ----
  private createSidebarUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    const sidebarW = 240;
    const container = this.add.container(0, 0).setDepth(1000);
    container.setScrollFactor(0);

    const bg = this.add.rectangle(w - sidebarW, 0, sidebarW, h, 0xe9f1f7, 1).setOrigin(0);
    const top = this.add.rectangle(w - sidebarW, 0, sidebarW, 50, 0xd0e4f2, 1).setOrigin(0);
    container.add(bg); container.add(top);

    const title = this.add.text(w - sidebarW + 12, 12, 'Field Report', { fontSize: '18px', color: '#111' });
    container.add(title);

    const status = this.add.text(w - sidebarW + 12, 70, 'Walk around the grass. Pokémon spawn every 3–8s. Press ENTER when near one!', { fontSize: '16px', color: '#222', wordWrap: { width: sidebarW - 24 } });
    container.add(status);
    this.uiStatus = status;

    this.ui = container;
  }

  private setStatus(text: string) {
    if (this.uiStatus) this.uiStatus.setText(text);
  }

  private statusOnce(text: string, cooldownMs = 800) {
    const now = this.time.now;
    if (now - this.lastStatusAt < cooldownMs) return;
    this.lastStatusAt = now;
    this.setStatus(text);
  }

  // ---- Multiplayer (kept) ----
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      socket.removeAllListeners();
      socket.disconnect();
      this.socket = undefined;
      this.myId = undefined;
      this.others.forEach((s) => s.destroy());
      this.others.clear();
    });
  }

  private spawnOther(id: string, x: number, y: number) {
    const s = this.add.sprite(x, y, "player").setTint(0x118ab2);
    s.setDepth(5);
    this.others.set(id, s);
  }
}
