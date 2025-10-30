import * as Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import { catchPokemon as apiCatch } from "../api/api";
import { SpawnManager } from "../spawnUtils";
import { ZONE_TILES, generateZones } from "../mapZones";
import { BIOMES, type BiomeId, type StructureDef, type StructureType } from "../biomes";

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
  onSpawnsUpdate?: (spawns: { key: string; name: string; pokeId: number; spriteUrl: string; position: { x: number; y: number }; level: number; rarity: string }[]) => void;
  playerPokemon?: any; // Selected Pokémon for battle
  trainerLevel?: number; // Trainer level for spawn balancing
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

  // Cached map dimensions
  private mapWidthTiles = 0;
  private mapHeightTiles = 0;
  private tileSizePx = 32;
  private others: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private lastSent = 0;

  // Spawns (managed by SpawnManager)
  private spawnManager?: SpawnManager;

  // UI (sidebar) - removed in favor of React/Next UI
  private lastStatusAt = 0;

  // Minimap
  private mini?: Phaser.GameObjects.Container;
  private miniGfx?: Phaser.GameObjects.Graphics;
  private miniMarkers?: Phaser.GameObjects.Container;
  private miniHighlight?: Phaser.GameObjects.Graphics;
  private miniBuildings?: Phaser.GameObjects.Container;
  private miniW = 160;
  private miniH = 160;

// Toast notification
  private toast?: Phaser.GameObjects.Text;
  private autosaveTimer?: Phaser.Time.TimerEvent;
  private hud?: Phaser.GameObjects.Container;
  private hudText?: Phaser.GameObjects.Text;
  private hudBarBg?: Phaser.GameObjects.Rectangle;
  private hudBarFg?: Phaser.GameObjects.Rectangle;

  // Structures
  private structures: StructureDef[] = [];
  private insideStructure: { active: boolean; type: StructureType | null } = { active: false, type: null };

  // Environment overlay (no particles to avoid runtime incompat)
  private envOverlay?: Phaser.GameObjects.Rectangle;

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
    
    // Check if texture already exists, destroy it first
    if (this.textures.exists("tilesheet")) {
      this.textures.remove("tilesheet");
    }
    
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
    if (this.textures.exists("player")) {
      this.textures.remove("player");
    }
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
    this.tileSizePx = tileSize;
    this.mapWidthTiles = mapWidth;
    this.mapHeightTiles = mapHeight;

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


    // Multiplayer socket (kept from your original)
    this.initMultiplayer();

    // Environment overlay
    this.envOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.08).setOrigin(0).setScrollFactor(0).setDepth(900);

    // Minimap overlay (no grid lines)
    this.createMiniMap();

    // HUD (Level + XP)
    this.createHUD();

    // Zone-aware spawn manager with trainer level
    const trainerLevel = this.configData.trainerLevel || 1;
    this.spawnManager = new SpawnManager(this, tileSize, mapWidth, mapHeight, trainerLevel);
    this.spawnManager.on("spawned", (rec: any) => {
      this.addMiniMarker(rec.key, rec.position.x, rec.position.y);
      this.statusOnce(`A wild ${capitalize(rec.name)} appeared near you!`, 800);
      this.configData.onPokemonSpotted?.({ name: rec.name, spriteUrl: rec.spriteUrl, pokeId: rec.pokeId });
      this.pushSpawnsToUI();
    });
    this.spawnManager.on("despawned", (_key: string) => {
      this.removeMiniMarker(_key);
      if (this.spawnManager!.getActiveSpawns().length === 0) this.configData.onPokemonCleared?.();
      this.pushSpawnsToUI();
    });
    this.spawnManager.on("spawnClicked", async (key: string) => {
      await this.startBattleFromKey(key);
    });
    this.spawnManager.on("zoneChanged", (z: any) => {
      this.highlightMiniZone();
      const czx = (z.col * ZONE_TILES + ZONE_TILES / 2) * tileSize;
      const czy = (z.row * ZONE_TILES + ZONE_TILES / 2) * tileSize;
      const cam = this.cameras.main;
      cam.stopFollow();
      cam.pan(czx, czy, 300, "Sine.easeInOut", true, (camera: any, progress: number) => {
        if (progress === 1) cam.startFollow(this.player, true, 0.1, 0.1);
      });
      // apply biome environment tint
      const zones = generateZones(Math.floor(this.mapWidthTiles / ZONE_TILES), Math.floor(this.mapHeightTiles / ZONE_TILES));
      const meta = zones.find((q) => q.id === `${z.col},${z.row}`);
      if (meta) this.applyBiome(meta.biome as BiomeId);
    });
    this.generateStructures();
    this.spawnManager.start();

    // Load trainer data if wallet connected
    this.initTrainerPersistence();

    // Autosave every ~2.5 minutes
    this.autosaveTimer = this.time.addEvent({ delay: 150000, loop: true, callback: () => this.autosave("interval") });

    // Save on unload
    if (typeof window !== 'undefined') {
      const handler = () => { this.autosave("unload"); };
      window.addEventListener('beforeunload', handler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('beforeunload', handler));
    }
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

    // Keep UI + minimap pinned
    if (this.mini) this.mini.setScrollFactor(0);

    // Throttled position sync (multiplayer)
    const now = this.time.now;
    if (this.socket && now - this.lastSent > 100) {
      this.socket.emit("move", { x: this.player.x, y: this.player.y });
      this.lastSent = now;
    }

    // Update zone tracking for spawns/minimap
    this.spawnManager?.updatePlayerPos(this.player.x, this.player.y);

    // Battle when near and Enter pressed (compat)
    if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      const nearest = this.getNearestActive(64);
      if (nearest) this.startBattleFromKey(nearest.key);
    }
  }


  // ---- UI helpers ----

  private statusOnce(_text: string, cooldownMs = 800) {
    const now = this.time.now;
    if (now - this.lastStatusAt < cooldownMs) return;
    this.lastStatusAt = now;
    // React sidebar now handles messaging
  }

  private createHUD() {
    const w = 220; const h = 14;
    // Place HUD below minimap to avoid overlap
    const y = (this.miniH || 160) + 20;
    this.hud = this.add.container(12, y).setScrollFactor(0).setDepth(2000);
    const bg = this.add.rectangle(0, 0, w, h + 16, 0x000000, 0.5).setOrigin(0);
    this.hudBarBg = this.add.rectangle(10, 8, w - 20, h, 0x333333, 1).setOrigin(0);
    this.hudBarFg = this.add.rectangle(10, 8, 0, h, 0x2ecc71, 1).setOrigin(0);
    this.hudText = this.add.text(12, -8, 'Lv.1 0/100 XP', { fontSize: '12px', color: '#fff' });
    this.hud.add([bg, this.hudBarBg, this.hudBarFg, this.hudText!]);
  }

  private updateHUD(level: number, currentXP: number, nextLevelXP: number) {
    const w = (this.hudBarBg?.width || 200);
    const pct = Math.max(0, Math.min(1, (nextLevelXP ? currentXP / nextLevelXP : 0)));
    if (this.hudBarFg) this.hudBarFg.width = Math.floor(w * pct);
    if (this.hudText) this.hudText.setText(`Lv.${level} ${currentXP}/${nextLevelXP} XP`);
  }

  private async initTrainerPersistence() {
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (!wallet) return;
      const { loadTrainer, autosaveTrainer } = await import('../../src/services/trainer');
      const { flushQueue } = await import('../../src/services/saveQueue');
      // try to flush any queued saves first
      try { await flushQueue(); } catch {}
      const res = await loadTrainer(wallet).catch(() => null);
      if (res?.trainer) {
        const t = res.trainer;
        if (t?.location) {
          this.player.setPosition(t.location.x || this.player.x, t.location.y || this.player.y);
        }
        if (typeof t.level === 'number') this.configData.trainerLevel = t.level;
        this.updateHUD(t.level || 1, t.currentXP || 0, t.nextLevelXP || 100);
        this.showSavedToast('Trainer data loaded successfully!');
      } else {
        // create initial snapshot
        await autosaveTrainer({ walletAddress: wallet, level: 1, xp: 0, location: { x: this.player.x, y: this.player.y, biome: 'grassland' } });
      }
    } catch {}
  }

  private async autosave(reason: string) {
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (!wallet) return;
      const { autosaveTrainer } = await import('../../src/services/trainer');
      const xp = typeof window !== 'undefined' ? parseInt(localStorage.getItem('trainer_exp') || '0', 10) : 0;
      await autosaveTrainer({ walletAddress: wallet, xp, level: this.configData.trainerLevel || 1, location: { x: this.player.x, y: this.player.y } });
      this.showSavedToast('Progress Saved');
    } catch (e) {
      // enqueue offline save
      try {
        const base = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000') + '/api/autosave';
        const { enqueueSave } = await import('../../src/services/saveQueue');
        const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : undefined;
        await enqueueSave({ url: base, method: 'POST', headers: { 'Content-Type': 'application/json', ...(wallet ? { 'x-wallet-address': wallet } : {}) }, body: { walletAddress: wallet, level: this.configData.trainerLevel || 1, location: { x: this.player.x, y: this.player.y } } });
      } catch {}
    }
  }

  private showSavedToast(text: string) {
    if (this.toast) { this.toast.destroy(); this.toast = undefined; }
    const t = this.add.text(12, this.scale.height - 28, `💾 ${text}`, { fontSize: '14px', color: '#0f0', backgroundColor: '#000', padding: { x: 8, y: 4 } })
      .setScrollFactor(0)
      .setDepth(2000);
    this.toast = t;
    this.time.delayedCall(1600, () => { if (t.scene) t.destroy(); if (this.toast === t) this.toast = undefined; });
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

  // ---- Minimap ----
  private createMiniMap() {
    // Place top-left inside gameplay area (away from right sidebar)
    const baseX = 12;
    const baseY = 12;
    this.mini = this.add.container(baseX, baseY).setDepth(1000);
    this.mini.setScrollFactor(0);

    const bg = this.add.rectangle(0, 0, this.miniW, this.miniH, 0x111111, 0.6).setOrigin(0);
    this.miniGfx = this.add.graphics();
    this.miniMarkers = this.add.container(0, 0);
    this.miniBuildings = this.add.container(0, 0);
    this.miniHighlight = this.add.graphics();

    // no grid lines to keep zones invisible
    const cols = Math.max(1, Math.floor(this.mapWidthTiles / ZONE_TILES));
    const rows = Math.max(1, Math.floor(this.mapHeightTiles / ZONE_TILES));
    this.miniGfx.clear();
    this.miniGfx.lineStyle(1, 0x333333, 0.8);
    this.miniGfx.strokeRect(0, 0, this.miniW, this.miniH);

    // clickable zone
    const hit = this.add.zone(0, 0, this.miniW, this.miniH).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (_pointer: any, localX: number, localY: number) => {
      const zc = Math.floor(localX / (this.miniW / cols));
      const zr = Math.floor(localY / (this.miniH / rows));
      const cx = (zc * ZONE_TILES + ZONE_TILES / 2) * this.tileSizePx;
      const cy = (zr * ZONE_TILES + ZONE_TILES / 2) * this.tileSizePx;
      const cam = this.cameras.main;
      cam.stopFollow();
      cam.pan(cx, cy, 300, 'Sine.easeInOut', true, (camera: any, progress: number) => {
        if (progress === 1) cam.startFollow(this.player, true, 0.1, 0.1);
      });
    });

    this.mini.add([bg, this.miniGfx, this.miniHighlight, this.miniBuildings, this.miniMarkers, hit]);
    this.highlightMiniZone();
  }

  private highlightMiniZone() {
    if (!this.miniHighlight) return;
    const grid = this.spawnManager?.getZoneGrid();
    const cols = grid?.cols ?? Math.max(1, Math.floor(this.mapWidthTiles / ZONE_TILES));
    const rows = grid?.rows ?? Math.max(1, Math.floor(this.mapHeightTiles / ZONE_TILES));
    const cur = this.spawnManager?.getCurrentZone();
    if (!cur) return;
    const cw = this.miniW / cols;
    const ch = this.miniH / rows;
    this.miniHighlight.clear();
    this.miniHighlight.lineStyle(2, 0xffff66, 1);
    this.miniHighlight.strokeRect(cur.col * cw, cur.row * ch, cw, ch);
  }

  private worldToMini(x: number, y: number) {
    const sx = this.miniW / (this.mapWidthTiles * this.tileSizePx);
    const sy = this.miniH / (this.mapHeightTiles * this.tileSizePx);
    return { x: x * sx, y: y * sy };
  }

  private addMiniMarker(key: string, wx: number, wy: number) {
    if (!this.miniMarkers) return;
    const pt = this.worldToMini(wx, wy);
    const dot = this.add.rectangle(pt.x, pt.y, 4, 4, 0xffffff, 1).setOrigin(0.5);
    (dot as any).name = key;
    this.miniMarkers.add(dot);
  }

  private removeMiniMarker(key: string) {
    if (!this.miniMarkers) return;
    const list = (this.miniMarkers as any).list as Phaser.GameObjects.GameObject[];
    const found = list.find((ch: any) => ch.name === key);
    if (found) found.destroy();
  }

  private getNearestActive(radius: number): any | null {
    if (!this.spawnManager) return null;
    let best: any = null;
    let bestD = Number.POSITIVE_INFINITY;
    this.spawnManager.getActiveSpawns().forEach((rec: any) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, rec.position.x, rec.position.y);
      if (d < radius && d < bestD) { bestD = d; best = rec; }
    });
    return best;
  }

  private async startBattleFromKey(key: string) {
    if (!this.spawnManager) return;
    const rec = this.spawnManager.getActiveSpawns().find(r => r.key === key);
    if (!rec) return;
    if (!this.configData.playerPokemon) {
      this.statusOnce('You need a Pokémon to battle!', 800);
      return;
    }
    try {
      const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${rec.pokeId}`);
      const pokeData = await pokeRes.json();
      this.spawnManager.despawn(key);
      
      // Transform player Pokemon to match BattleScene expected format
      const playerPoke = this.configData.playerPokemon;
      const hpStat = playerPoke.data?.stats?.find((s: any) => s.stat.name === 'hp')?.base_stat || 50;
      const maxHp = Math.floor(hpStat * 1.5 * (playerPoke.level || 1));
      
      this.scene.start('BattleScene', {
        wildPokemon: {
          name: rec.name,
          pokeId: rec.pokeId,
          data: pokeData,
          spriteUrl: rec.spriteUrl,
          level: rec.level,
        },
        playerPokemon: {
          name: playerPoke.name || playerPoke.displayName,
          pokeId: playerPoke.id,
          data: playerPoke.data,
          spriteUrl: playerPoke.sprite,
          level: playerPoke.level || 1,
          maxHp: maxHp,
          currentHp: maxHp,
        },
        trainerLevel: this.configData.trainerLevel || 1,
      });
    } catch {}
  }

  // ---- Structures ----
  private generateStructures() {
    const cols = Math.max(1, Math.floor(this.mapWidthTiles / ZONE_TILES));
    const rows = Math.max(1, Math.floor(this.mapHeightTiles / ZONE_TILES));
    const zones = generateZones(cols, rows);
    const choose = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const byBiome: Record<string, StructureType[]> = {
      city: ["lab", "house"],
      mountain: ["temple", "house"],
      forest: ["house", "tower"],
      desert: ["temple"],
      lake: ["tower"],
      grassland: ["house"],
      cave: ["tower"],
      snowfield: ["house", "temple"],
    } as any;

    this.structures = [];
    zones.forEach((z) => {
      if (Math.random() > 0.12) return; // ~12% of zones have a building
      const types = byBiome[z.biome] || ["house"];
      const type = choose(types);
      const startX = z.col * ZONE_TILES * this.tileSizePx;
      const startY = z.row * ZONE_TILES * this.tileSizePx;
      const x = startX + 16 + Math.random() * (ZONE_TILES * this.tileSizePx - 32);
      const y = startY + 16 + Math.random() * (ZONE_TILES * this.tileSizePx - 32);
      const id = `b-${z.id}-${type}-${Math.floor(x)}-${Math.floor(y)}`;
      this.structures.push({ id, type, col: z.col, row: z.row, x, y });
    });

    // render
    this.structures.forEach((s) => {
      const color = s.type === "lab" ? 0xcfe3ff : s.type === "tower" ? 0x6b4e9b : s.type === "temple" ? 0xc2b280 : 0xd3d3d3;
      const building = this.add.rectangle(s.x, s.y, 32, 24, color, 1).setOrigin(0.5).setDepth(15);
      this.physics.add.existing(building, true);
      const door = this.add.rectangle(s.x, s.y + 12, 10, 6, 0x000000, 0.8).setDepth(16);
      this.physics.add.existing(door, true);
      this.physics.add.overlap(this.player, door, () => this.enterStructure(s));
      // minimap marker
      if (this.miniBuildings) {
        const pt = this.worldToMini(s.x, s.y);
        const sq = this.add.rectangle(pt.x, pt.y, 5, 5, 0xffe066, 1).setOrigin(0.5);
        this.miniBuildings.add(sq);
      }
    });
  }

  private enterStructure(s: StructureDef) {
    if (this.insideStructure.active) return;
    this.insideStructure = { active: true, type: s.type } as any;
    // override spawn pool based on structure -> use BIOMES mapping
    const b = s.type === "tower" ? BIOMES.tower : s.type === "lab" ? BIOMES.lab : BIOMES.temple;
    this.applyBiome(b.id);
    this.spawnManager?.setOverrideTypes(b.pokemonPool);
  }

  private exitStructure() {
    if (!this.insideStructure.active) return;
    this.insideStructure = { active: false, type: null } as any;
    // clear override and re-apply zone biome color
    this.spawnManager?.setOverrideTypes(null);
    const cur = this.spawnManager?.getCurrentZone();
    if (cur) {
      const zones = generateZones(Math.floor(this.mapWidthTiles / ZONE_TILES), Math.floor(this.mapHeightTiles / ZONE_TILES));
      const meta = zones.find((q) => q.id === `${cur.col},${cur.row}`);
      if (meta) this.applyBiome(meta.biome as BiomeId);
    }
  }

  private applyBiome(id: BiomeId) {
    const def = BIOMES[id];
    if (!def) return;
    if (this.envOverlay) {
      const target = def.environmentColor;
      const from = (this.envOverlay.fillColor ?? 0xffffff) as number;
      const o = { t: 0 } as any;
      this.tweens.add({ targets: o, t: 1, duration: 400, onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(from),
          Phaser.Display.Color.IntegerToColor(target),
          100,
          Math.floor(o.t * 100)
        );
        const hex = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        this.envOverlay!.setFillStyle(hex, 0.08);
      }});
    }
  }

  private pushSpawnsToUI() {
    if (!this.configData.onSpawnsUpdate || !this.spawnManager) return;
    const spawns = this.spawnManager.getActiveSpawns().map((r: any) => ({
      key: r.key,
      name: r.name,
      pokeId: r.pokeId,
      spriteUrl: r.spriteUrl,
      position: r.position,
      level: r.level,
      rarity: r.rarity,
      distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, r.position.x, r.position.y),
    }));
    this.configData.onSpawnsUpdate(spawns);
  }
}
