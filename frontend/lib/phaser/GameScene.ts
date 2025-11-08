import * as Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import { catchPokemon as apiCatch } from "../api/api";
import { SpawnManager } from "../spawnUtils";
import { ZONE_TILES, generateZones } from "../mapZones";
import { BIOMES, type BiomeId, type StructureDef, type StructureType } from "../biomes";
import { UIManager } from "./managers/UIManager";
import MultiplayerHandler from "./managers/MultiplayerHandler";
import OtherPlayers from "./renderers/OtherPlayers";
import { TransactionManager } from "./managers/TransactionManager";
import { XPManager, type XPUpdateEvent } from "./managers/XPManager";

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
  private otherPositions: Map<string, { x: number; y: number; targetX: number; targetY: number; lastUpdate: number }> = new Map();
  private lastSent = 0;

  // Nearby trainers (ghost avatars)
  private ghosts: Map<string, { sprite: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text; username: string }> = new Map();
  private nearbyTimer?: Phaser.Time.TimerEvent;

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

  // Floating text animations
  private floatingTexts: Phaser.GameObjects.Text[] = [];

  // Multiplayer players (from MultiplayerHandler)
  private multiplayerPlayers: Map<string, { sprite: Phaser.GameObjects.Sprite; label?: Phaser.GameObjects.Text; data: any; targetX: number; targetY: number }> = new Map();
  private onlineCount = 0;
  private hudOnlineText?: Phaser.GameObjects.Text;

  // XP Manager
  private xpManager?: XPManager;

  // Phase 2 managers
  private ui?: UIManager;
  private mp?: MultiplayerHandler;
  private otherPlayers?: OtherPlayers;

  // HUD elements
  private hud?: Phaser.GameObjects.Container;
  private hudBarBg?: Phaser.GameObjects.Rectangle;
  private hudBarFg?: Phaser.GameObjects.Rectangle;
  private hudText?: Phaser.GameObjects.Text;

  // Backend spawns
  private backendSpawns: Map<string, { sprite: Phaser.GameObjects.Image; data: any; glowCircle?: Phaser.GameObjects.Arc; pulseTween?: Phaser.Tweens.Tween }> = new Map();
  private spawnPoll?: Phaser.Time.TimerEvent;

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

    // Phase 2 managers
    this.ui = new UIManager(this as unknown as Phaser.Scene);
    
    // Initialize simpler multiplayer system
    this.mp = new MultiplayerHandler();
    this.otherPlayers = new OtherPlayers(this);
    
    // Join game with initial position
    const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
    if (wallet) {
      this.mp.joinGame(wallet, startX, startY, "default");
    }
    
    // Subscribe to player updates
    this.mp.onPlayersUpdate((players) => {
      this.otherPlayers?.updatePlayers(players);
    });
    
    // Initialize XP Manager with current XP from trainer data
    const initialXP = typeof window !== 'undefined' ? parseInt(localStorage.getItem('trainer_exp') || '0', 10) : 0;
    this.xpManager = new XPManager(initialXP);
    
    // Listen for XP updates
    XPManager.onXPUpdate((event: XPUpdateEvent) => {
      this.handleXPUpdate(event);
    });

    // Hook TransactionManager to wallet events
    if (typeof window !== 'undefined') {
      // Listen for transaction confirmations from wallet
      const txHandler = async (e: any) => {
        const tx = e.detail;
        if (tx?.txId) {
          const wallet = localStorage.getItem('algorand_wallet_address');
          if (wallet) {
            await TransactionManager.logTransaction({
              wallet,
              txId: tx.txId,
              type: tx.type || 'TRANSACTION',
              asset: tx.asset || 'Yokai',
              meta: tx.meta
            });
            this.ui?.toastTop('Transaction confirmed');
          }
        }
      };
      window.addEventListener('yokai-transaction-logged', txHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('yokai-transaction-logged', txHandler);
      });
    }

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

    // Backend spawn polling
    const jitter = Phaser.Math.Between(20000, 40000);
    this.spawnPoll = this.time.addEvent({ delay: jitter, loop: true, callback: () => this.pollBackendSpawns() });
    // Kick first poll after a short delay
    this.time.delayedCall(1500, () => this.pollBackendSpawns());

    // Load trainer data if wallet connected
    this.initTrainerPersistence();

    // Start nearby trainers polling/heartbeat every 10s
    this.startNearbyPolling();

    // Listen for capture attempts from React overlay
    if (typeof window !== 'undefined') {
      const captureHandler = (e: any) => {
        const spawn = e.detail?.spawn;
        if (spawn) {
          this.performCapture(spawn);
        }
      };
      window.addEventListener('yokai-capture-attempt', captureHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('yokai-capture-attempt', captureHandler);
      });
      
      // Listen for zone spawns from socket
      const zoneSpawnsHandler = (e: any) => {
        const spawns = e.detail?.spawns || [];
        this.handleZoneSpawns(spawns);
      };
      window.addEventListener('yokai-zone-spawns', zoneSpawnsHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('yokai-zone-spawns', zoneSpawnsHandler);
      });
    }

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
    
    // Send position via simpler multiplayer handler
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (wallet && this.mp) {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const dir = Math.atan2(body.velocity.y, body.velocity.x) * (180 / Math.PI);
        this.mp.sendPosition(
          wallet,
          this.player.x,
          this.player.y,
          this.getCurrentBiomeId() || "default",
          dir
        );
      }
    } catch {}

    // Interpolate other players' positions (legacy socket.io)
    const INTERP_SPEED = 0.15; // Lerp factor (0-1)
    this.otherPositions.forEach((pos, id) => {
      const sprite = this.others.get(id);
      if (sprite) {
        // Smooth interpolation toward target
        pos.x = Phaser.Math.Linear(pos.x, pos.targetX, INTERP_SPEED);
        pos.y = Phaser.Math.Linear(pos.y, pos.targetY, INTERP_SPEED);
        sprite.setPosition(pos.x, pos.y);
      }
    });

    // Update zone tracking for spawns/minimap
    this.spawnManager?.updatePlayerPos(this.player.x, this.player.y);
    
    // Check spawn proximity every frame
    this.checkSpawnProximity();

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
    // Online players counter
    this.hudOnlineText = this.add.text(w + 20, -8, '0 Trainers Online', { fontSize: '11px', color: '#aaa' });
    this.hud.add([bg, this.hudBarBg, this.hudBarFg, this.hudText!, this.hudOnlineText!]);
  }

  private updateHUD(level: number, currentXP: number, nextLevelXP: number) {
    const w = (this.hudBarBg?.width || 200);
    const pct = Math.max(0, Math.min(1, (nextLevelXP ? currentXP / nextLevelXP : 0)));
    
    // Smooth animated progress bar
    if (this.hudBarFg) {
      const targetWidth = Math.floor(w * pct);
      this.tweens.add({
        targets: this.hudBarFg,
        width: targetWidth,
        duration: 500,
        ease: 'Power2'
      });
    }
    
    if (this.hudText) {
      this.hudText.setText(`Lv.${level} ${currentXP}/${nextLevelXP} XP`);
    }
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
        
        // Initialize XPManager with loaded XP
        if (this.xpManager && t.xp !== undefined) {
          this.xpManager.setXP(t.xp);
        }
        
        this.showSavedToast('Trainer data loaded successfully!');
      } else {
        // create initial snapshot
        await autosaveTrainer({ walletAddress: wallet, level: 1, xp: 0, location: { x: this.player.x, y: this.player.y, biome: 'grassland' } });
      }
      
      // Listen for XP updates from battle
      if (typeof window !== 'undefined') {
        const handler = (e: Event) => {
          const customEvent = e as CustomEvent<XPUpdateEvent>;
          if (customEvent.detail) {
            this.handleXPUpdate(customEvent.detail);
          }
        };
        window.addEventListener('trainer-xp-update', handler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          window.removeEventListener('trainer-xp-update', handler);
        });
      }
    } catch {}
  }
  
  private handleXPUpdate(event: XPUpdateEvent) {
    // Update HUD
    this.updateHUD(event.newLevel, event.currentXP, event.nextLevelXP);
    
    // Persist XP
    if (typeof window !== 'undefined') {
      localStorage.setItem('trainer_exp', event.newXP.toString());
    }
    
    // Update config
    this.configData.trainerLevel = event.newLevel;
    
    // Show floating XP animation
    this.showFloatingXP(this.player.x, this.player.y - 20, `+${event.xpGained} XP`);
    
    // Handle level up
    if (event.leveledUp) {
      this.ui?.toastTop(`🎉 Level Up! You reached Level ${event.newLevel}!`);
      this.showFloatingXP(this.player.x, this.player.y - 40, 'LEVEL UP!', 0xffff00);
      this.playLevelUpEffect();
      
      // Broadcast level up event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yokai-level-up', { detail: event }));
      }
    }
    
    // Broadcast XP update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yokai-xp-update', { detail: event }));
    }
  }

  private playLevelUpEffect() {
    // Particle burst effect around player
    const particles = this.add.particles(this.player.x, this.player.y, 'player', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.3, end: 0 },
      lifespan: 600,
      quantity: 20,
      tint: [0xffff00, 0xffd700, 0xffa500]
    });
    
    this.time.delayedCall(600, () => {
      particles.destroy();
    });
    
    // Flash effect
    const flash = this.add.rectangle(this.player.x, this.player.y, 100, 100, 0xffff00, 0.3);
    flash.setDepth(3001);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 500,
      onComplete: () => flash.destroy()
    });
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

  private async pollBackendSpawns() {
    try {
      const biome = this.getCurrentBiomeId();
      const lvl = this.configData.trainerLevel || 1;
      // Simple zone calculation fallback (10x10 tiles per zone)
      const zoneCol = Math.floor(this.player.x / (this.tileSizePx * 10));
      const zoneRow = Math.floor(this.player.y / (this.tileSizePx * 10));
      const zoneId = `zone_${zoneCol}_${zoneRow}`;
      
      // Poll spawns for current zone
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/spawn/sync?biome=${encodeURIComponent(biome)}&level=${lvl}&players=1&zoneId=${encodeURIComponent(zoneId)}&x=${Math.floor(this.player.x)}&y=${Math.floor(this.player.y)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list = data.spawns || [];
      // Add new spawns
      list.forEach((s: any) => {
        if (this.backendSpawns.has(s.id)) {
          // Update existing spawn position if changed
          const existing = this.backendSpawns.get(s.id);
          if (existing && (existing.data.x !== s.x || existing.data.y !== s.y)) {
            existing.sprite.setPosition(s.x, s.y);
            existing.data = s;
          }
          return;
        }
        const sprite = this.add.image(s.x, s.y, `pk-${s.pokeId}`).setVisible(false).setDepth(18).setInteractive({ useHandCursor: true });
        if (!this.textures.exists(`pk-${s.pokeId}`)) {
          this.load.image(`pk-${s.pokeId}`, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokeId}.png`);
          this.load.once(Phaser.Loader.Events.COMPLETE, () => sprite.setTexture(`pk-${s.pokeId}`));
          this.load.start();
        }
        // Glowing spawn circle (pulsing animation)
        const glowCircle = this.add.circle(s.x, s.y, 24, 0xffff66, 0.4).setDepth(17);
        const pulseTween = this.tweens.add({
          targets: glowCircle,
          radius: { from: 20, to: 32 },
          alpha: { from: 0.3, to: 0.6 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        // Spawn circle animation on first appearance
        const circle = this.add.circle(s.x, s.y, 6, 0xffff66, 0.6).setDepth(17);
        this.tweens.add({ targets: circle, radius: 26, alpha: 0, duration: 600, onComplete: () => circle.destroy() });
        // Click to attempt capture if near
        sprite.on('pointerdown', () => this.tryCaptureBackendSpawn(s));
        sprite.setVisible(true);
        this.backendSpawns.set(s.id, { sprite, data: s, glowCircle, pulseTween });
      });
      // Cleanup expired or missing (only for current zone)
      const cleanupZoneCol = Math.floor(this.player.x / (this.tileSizePx * 10));
      const cleanupZoneRow = Math.floor(this.player.y / (this.tileSizePx * 10));
      const currentZone = `zone_${cleanupZoneCol}_${cleanupZoneRow}`;
      for (const [id, rec] of this.backendSpawns.entries()) {
        // Remove if not in list OR if zone changed
        const inList = list.find((q: any) => q.id === id);
        const wrongZone = currentZone && rec.data.zoneId && rec.data.zoneId !== currentZone;
        if (!inList || wrongZone) {
          rec.sprite.destroy();
          if (rec.glowCircle) rec.glowCircle.destroy();
          if (rec.pulseTween) rec.pulseTween.destroy();
          this.backendSpawns.delete(id);
        }
      }
      // Check proximity for auto-opening CaptureModal
      this.checkSpawnProximity();
      if (list.length) this.ui?.toastTop('Pokémon nearby');
    } catch {}
  }

  private checkSpawnProximity() {
    const PROXIMITY_THRESHOLD = this.tileSizePx * 2.5; // ~80px
    Array.from(this.backendSpawns.values()).forEach((rec) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, rec.data.x, rec.data.y);
      if (dist <= PROXIMITY_THRESHOLD && !rec.data.proximityTriggered) {
        rec.data.proximityTriggered = true;
        // Open CaptureModal via React overlay
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('yokai-spawn-proximity', {
            detail: {
              spawn: {
                id: rec.data.id,
                name: rec.data.name,
                pokeId: rec.data.pokeId,
                level: rec.data.level,
                rarity: rec.data.rarity,
                x: rec.data.x,
                y: rec.data.y
              }
            }
          }));
        }
      } else if (dist > PROXIMITY_THRESHOLD) {
        rec.data.proximityTriggered = false;
      }
    });
  }

  private async tryCaptureBackendSpawn(spawn: any) {
    try {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, spawn.x, spawn.y);
      if (d > this.tileSizePx * 2.5) {
        this.ui?.toastTop('Move closer to catch');
        return;
      }
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (!wallet) {
        this.ui?.toastTop('Connect wallet to catch');
        return;
      }
      // Open CaptureModal via React overlay
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yokai-spawn-proximity', {
          detail: {
            spawn: {
              id: spawn.id,
              name: spawn.name,
              pokeId: spawn.pokeId,
              level: spawn.level,
              rarity: spawn.rarity,
              x: spawn.x,
              y: spawn.y
            }
          }
        }));
      }
    } catch {}
  }

  async performCapture(spawn: any): Promise<void> {
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (!wallet) {
        this.ui?.toastTop('Connect wallet to catch');
        return;
      }

      // Convert sprite URL to base64
      const spriteUrl = spawn.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spawn.pokeId}.png`;
      let imageBase64 = '';
      
      try {
        const imgResp = await fetch(spriteUrl);
        const blob = await imgResp.blob();
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Failed to convert image to base64:', e);
        this.ui?.toastTop('Failed to process image');
        return;
      }

      // Call new /api/pokemon/caught endpoint
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/pokemon/caught`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-wallet-address': wallet },
        body: JSON.stringify({
          wallet,
          name: spawn.name,
          imageBase64,
          rarity: spawn.rarity || 'common'
        })
      });
      const js = await resp.json().catch(() => ({}));
      if (js.success) {
        // Calculate XP gained (5 for attempt + 25 for success = 30 total)
        const xpGained = 30;
        
        // Use XPManager to add XP
        if (this.xpManager) {
          const xpEvent = this.xpManager.addXP(xpGained);
          // XPManager will trigger handleXPUpdate via listener
        } else {
          // Fallback if XPManager not initialized
          const oldLevel = this.configData.trainerLevel || 1;
          const oldXP = typeof window !== 'undefined' ? parseInt(localStorage.getItem('trainer_exp') || '0', 10) : 0;
          const newXP = oldXP + xpGained;
          if (typeof window !== 'undefined') {
            localStorage.setItem('trainer_exp', newXP.toString());
          }
          const levelData = XPManager.levelFromXP(newXP);
          this.updateHUD(levelData.level, levelData.currentXP, levelData.nextLevelXP);
          this.configData.trainerLevel = levelData.level;
          this.showFloatingXP(this.player.x, this.player.y - 20, `+${xpGained} XP`);
          if (levelData.level > oldLevel) {
            this.ui?.toastTop('Level up!');
            this.showFloatingXP(this.player.x, this.player.y - 40, 'LEVEL UP!', 0xffff00);
          }
        }
        
        this.ui?.toastTop('Capture success!');
        
        // Remove spawn from map
        const rec = this.backendSpawns.get(spawn.id);
        if (rec) {
          rec.sprite.destroy();
          if (rec.glowCircle) rec.glowCircle.destroy();
          if (rec.pulseTween) rec.pulseTween.destroy();
          this.backendSpawns.delete(spawn.id);
        }
        
        // Broadcast capture success event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('yokai-capture-result', {
            detail: { 
              outcome: js.optInRequired ? 'optInRequired' : 'success', 
              txId: js.txIdSend || js.txIdMint, 
              txIdMint: js.txIdMint,
              txIdSend: js.txIdSend,
              assetId: js.assetId,
              ipfs: js.metadataCID,
              pokemon: spawn,
              xpGained: xpGained,
              optInRequired: js.optInRequired || false
            }
          }));
        }
        
        // Log tx for 📜 Log
        if (js.txId) {
          await TransactionManager.logCapture({ wallet, txId: js.txId, meta: { pokeId: spawn.pokeId, name: spawn.name } });
        }
        
        // Log XP transaction
        if (this.xpManager) {
          const levelData = this.xpManager.getLevelData();
          await TransactionManager.logTransaction({
            wallet,
            txId: js.txId || `XP-${Date.now()}`,
            type: 'XP_GAIN',
            asset: 'XP',
            meta: { xpGained, level: levelData.level, currentXP: levelData.currentXP }
          });
        }
      } else {
        // Failed capture - still gain attempt XP
        const attemptXP = 5;
        if (this.xpManager) {
          this.xpManager.addXP(attemptXP);
        }
        
        this.ui?.toastTop('Pokémon escaped! You still gained +5 XP.');
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('yokai-capture-result', { 
            detail: { outcome: 'fail', xpGained: attemptXP } 
          }));
        }
      }
    } catch (e) {
      this.ui?.toastTop('Capture failed');
    }
  }

  private showFloatingXP(x: number, y: number, text: string, color: number = 0x2ecc71) {
    const txt = this.add.text(x, y, text, {
      fontSize: '18px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(3000);
    
    // Animate floating up and fading out
    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => txt.destroy()
    });
  }

  private showSavedToast(text: string) {
    if (this.toast) { this.toast.destroy(); this.toast = undefined; }
    const t = this.add.text(12, this.scale.height - 28, `💾 ${text}`, { fontSize: '14px', color: '#0f0', backgroundColor: '#000', padding: { x: 8, y: 4 } })
      .setScrollFactor(0)
      .setDepth(2000);
    this.toast = t;
    this.time.delayedCall(1600, () => { if (t.scene) t.destroy(); if (this.toast === t) this.toast = undefined; });
  }

  private getCurrentBiomeId(): string {
    const cols = Math.max(1, Math.floor(this.mapWidthTiles / ZONE_TILES));
    const rows = Math.max(1, Math.floor(this.mapHeightTiles / ZONE_TILES));
    const zones = generateZones(cols, rows);
    const cur = this.spawnManager?.getCurrentZone();
    const meta = cur ? zones.find((q) => q.id === `${cur.col},${cur.row}`) : undefined;
    return (meta?.biome || 'grassland') as string;
  }

  private startNearbyPolling() {
    // Clear existing
    this.nearbyTimer?.remove(false);
    this.nearbyTimer = this.time.addEvent({ delay: 10000, loop: true, callback: async () => {
      try {
        const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
        const username = typeof window !== 'undefined' ? (localStorage.getItem('trainer_username') || 'Trainer') : 'Trainer';
        if (!wallet) return;
        const biome = this.getCurrentBiomeId();
        const tileX = Math.floor(this.player.x / this.tileSizePx);
        const tileY = Math.floor(this.player.y / this.tileSizePx);
        const svc = await import('../../src/services/trainer');
        // upsert presence
        await svc.updateActivePosition({ walletAddress: wallet, x: tileX, y: tileY, biome });
        // fetch nearby
        const data = await svc.fetchNearby({ walletAddress: wallet, x: tileX, y: tileY, biome }).catch(() => null);
        const list = data?.trainers || [];
        this.renderGhosts(list);
      } catch {}
    }});

    // first immediate tick
    this.time.delayedCall(500, () => this.nearbyTimer?.callback?.());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.nearbyTimer?.remove(false);
      this.ghosts.forEach((g) => { g.sprite.destroy(); g.label?.destroy(); });
      this.ghosts.clear();
    });
  }

  private renderGhosts(list: { walletAddress: string; username: string; x: number; y: number }[]) {
    const wanted = new Set(list.map((t) => t.walletAddress.toLowerCase()));
    // remove stale
    Array.from(this.ghosts.keys()).forEach((k) => { if (!wanted.has(k.toLowerCase())) { const g = this.ghosts.get(k)!; g.sprite.destroy(); g.label?.destroy(); this.ghosts.delete(k); } });
    // upsert
    list.forEach((t) => {
      const id = t.walletAddress;
      const wx = (t.x || 0) * this.tileSizePx + this.tileSizePx / 2;
      const wy = (t.y || 0) * this.tileSizePx + this.tileSizePx / 2;
      let g = this.ghosts.get(id);
      if (!g) {
        const s = this.add.image(wx, wy, 'player').setTint(0xffffff).setAlpha(0.5).setDepth(8);
        s.setScale(0.9);
        s.setInteractive({ useHandCursor: true });
        const showTip = () => {
          if (g?.label) g.label.destroy();
          g!.label = this.add.text(s.x, s.y - 18, t.username || 'Trainer', { fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(1001);
        };
        s.on('pointerover', showTip);
        s.on('pointerout', () => { g?.label?.destroy(); g!.label = undefined; });
        s.on('pointerdown', () => this.promptChallenge(t.username || 'Trainer'));
        g = { sprite: s, username: t.username || 'Trainer' };
        this.ghosts.set(id, g);
      }
      // move/update
      g.sprite.x = wx; g.sprite.y = wy; g.username = t.username || g.username;
      if (g.label) { g.label.x = wx; g.label.y = wy - 18; g.label.setText(g.username); }
    });
  }

  private promptChallenge(name: string) {
    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2).setDepth(2001);
    const bg = this.add.rectangle(0, 0, 300, 160, 0x000000, 0.85);
    const border = this.add.rectangle(0, 0, 300, 160).setStrokeStyle(2, 0xffffff);
    const txt = this.add.text(0, -30, `Challenge ${name}?`, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    const ok = this.add.text(-40, 30, 'Challenge', { fontSize: '14px', color: '#0f0', backgroundColor: '#222', padding: { x: 10, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const cancel = this.add.text(60, 30, 'Cancel', { fontSize: '14px', color: '#fff', backgroundColor: '#444', padding: { x: 10, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    ok.on('pointerdown', () => { this.showSavedToast(`You challenged ${name}! (mock)`); modal.destroy(); });
    cancel.on('pointerdown', () => modal.destroy());
    modal.add([bg, border, txt, ok, cancel]);
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
          // Update interpolation target
          const pos = this.otherPositions.get(id);
          if (pos) {
            pos.targetX = x;
            pos.targetY = y;
            pos.lastUpdate = this.time.now;
          } else {
            // Initialize position tracking
            this.otherPositions.set(id, { x, y, targetX: x, targetY: y, lastUpdate: this.time.now });
            sprite.setPosition(x, y);
          }
        }
      },
    );

    socket.on("playerLeft", ({ id }: { id: string }) => {
      const sprite = this.others.get(id);
      if (sprite) {
        sprite.destroy();
        this.others.delete(id);
      }
      this.otherPositions.delete(id);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      socket.removeAllListeners();
      socket.disconnect();
      this.socket = undefined;
      this.myId = undefined;
      this.others.forEach((s) => s.destroy());
      this.others.clear();
      this.otherPositions.clear();
      
      // Cleanup multiplayer players
      this.multiplayerPlayers.forEach((player) => {
        player.sprite.destroy();
        if (player.label) player.label.destroy();
      });
      this.multiplayerPlayers.clear();
      
      // Disconnect MultiplayerHandler
      this.mp?.disconnect();
    });
  }

  private spawnOther(id: string, x: number, y: number) {
    const s = this.add.sprite(x, y, "player").setTint(0x118ab2);
    s.setDepth(5);
    this.others.set(id, s);
    // Initialize position tracking for interpolation
    this.otherPositions.set(id, { x, y, targetX: x, targetY: y, lastUpdate: this.time.now });
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
      const level = playerPoke.level || 1;
// Use proper Pokemon HP formula with IV ~31: ((2*Base + 31) * Level / 100) + Level + 10
      const maxHp = Math.max(28, Math.floor(((hpStat * 2 + 31) * level) / 100 + level + 10));
      
      // Build player team (at minimum includes the current Pokemon)
      const playerTeam = [{
        id: playerPoke.id,
        name: playerPoke.name || playerPoke.displayName,
        data: playerPoke.data,
        sprite: playerPoke.sprite,
        level: playerPoke.level || 1,
        maxHp: maxHp,
      }];
      
      this.scene.pause(); // Pause GameScene instead of stopping it
      this.scene.launch('BattleScene', {
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
        playerTeam: playerTeam,
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

  // ---- Multiplayer rendering ----

  private onMultiplayerPlayerJoin(player: any) {
    const wallet = player.wallet;
    const myWallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
    if (wallet === myWallet) return; // Don't render self
    
    // Check if player is nearby (within reasonable distance)
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, player.x, player.y);
    if (dist > this.tileSizePx * 20) return; // Too far, don't show
    
    // Create sprite (smaller than player)
    const sprite = this.add.sprite(player.x, player.y, 'player');
    sprite.setTint(0x4a90e2); // Blue tint for other players
    sprite.setScale(0.75); // Smaller than player
    sprite.setDepth(9);
    
    // Create label above sprite
    const name = player.name || player.wallet.slice(0, 6);
    const label = this.add.text(player.x, player.y - 20, name, {
      fontSize: '10px',
      color: '#fff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(1000);
    
    this.multiplayerPlayers.set(wallet, {
      sprite,
      label,
      data: player,
      targetX: player.x,
      targetY: player.y
    });
    
    // Toast notification
    this.ui?.toastTop(`${name} entered your area`);
  }

  private onMultiplayerPlayerLeave(wallet: string) {
    const player = this.multiplayerPlayers.get(wallet);
    if (!player) return;
    
    const name = player.data.name || wallet.slice(0, 6);
    
    // Fade out and destroy
    this.tweens.add({
      targets: [player.sprite, player.label],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        player.sprite.destroy();
        if (player.label) player.label.destroy();
        this.multiplayerPlayers.delete(wallet);
      }
    });
    
    // Toast notification
    this.ui?.toastTop(`${name} left your area`);
  }

  private updateOnlineCounter() {
    if (this.hudOnlineText) {
      const count = this.onlineCount;
      this.hudOnlineText.setText(`${count} Trainer${count !== 1 ? 's' : ''} Online`);
    }
  }

  private updateMultiplayerPlayers() {
    // This method is kept for compatibility but the simpler system uses OtherPlayers renderer
    // The OtherPlayers renderer handles player updates via onPlayersUpdate callback
    // No-op: player rendering is handled by OtherPlayers class
  }

  private onZoneChanged(oldZone: string | null, newZone: string) {
    // Clear spawns from old zone
    if (oldZone) {
      // Remove spawns that don't belong to new zone
      for (const [id, rec] of this.backendSpawns.entries()) {
        if (rec.data.zoneId && rec.data.zoneId !== newZone) {
          rec.sprite.destroy();
          if (rec.glowCircle) rec.glowCircle.destroy();
          if (rec.pulseTween) rec.pulseTween.destroy();
          this.backendSpawns.delete(id);
        }
      }
      this.ui?.toastTop(`Entered zone ${newZone}`);
    }
    
    // Request spawns for new zone
    this.pollBackendSpawns();
  }

  private handleZoneSpawns(spawns: any[]) {
    // Update spawns from socket broadcast
    const spawnZoneCol = Math.floor(this.player.x / (this.tileSizePx * 10));
    const spawnZoneRow = Math.floor(this.player.y / (this.tileSizePx * 10));
    const currentZone = `zone_${spawnZoneCol}_${spawnZoneRow}`;
    if (!currentZone) return;
    
    spawns.forEach((s: any) => {
      if (s.zoneId !== currentZone) return; // Only process spawns for current zone
      
      if (!this.backendSpawns.has(s.id)) {
        // Add new spawn
        const sprite = this.add.image(s.x, s.y, `pk-${s.pokeId}`).setVisible(false).setDepth(18).setInteractive({ useHandCursor: true });
        if (!this.textures.exists(`pk-${s.pokeId}`)) {
          this.load.image(`pk-${s.pokeId}`, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokeId}.png`);
          this.load.once(Phaser.Loader.Events.COMPLETE, () => sprite.setTexture(`pk-${s.pokeId}`));
          this.load.start();
        }
        const glowCircle = this.add.circle(s.x, s.y, 24, 0xffff66, 0.4).setDepth(17);
        const pulseTween = this.tweens.add({
          targets: glowCircle,
          radius: { from: 20, to: 32 },
          alpha: { from: 0.3, to: 0.6 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        sprite.on('pointerdown', () => this.tryCaptureBackendSpawn(s));
        sprite.setVisible(true);
        this.backendSpawns.set(s.id, { sprite, data: s, glowCircle, pulseTween });
      }
    });
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
