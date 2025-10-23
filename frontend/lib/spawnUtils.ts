import * as Phaser from "phaser";
import { BIOME_TYPE_POOLS, ZONE_TILES, generateZones, getAdjacentZoneCoords, getZoneForTile, type Biome } from "./mapZones";

export type SpawnRarity = "common" | "rare" | "legendary";

export type SpawnRecord = {
  key: string;
  name: string;
  pokeId: number;
  types: string[];
  spriteUrl: string;
  position: { x: number; y: number };
  zone: { col: number; row: number; id: string };
  sprite?: Phaser.GameObjects.Image;
  timeout?: Phaser.Time.TimerEvent;
  marker?: Phaser.GameObjects.Shape; // minimap marker
};

const MAX_ACTIVE = 8;

// Weighted rarity target buckets
const RARITY_WEIGHTS: Record<SpawnRarity, number> = {
  common: 0.7,
  rare: 0.25,
  legendary: 0.05,
};

function pickRarity(): SpawnRarity {
  const r = Math.random();
  if (r < RARITY_WEIGHTS.common) return "common";
  if (r < RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare) return "rare";
  return "legendary";
}

async function fetchPokemon(pokeId: number) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
  const data = await res.json();
  const types: string[] = data.types?.map((t: any) => t.type.name) || [];
  const spriteUrl = data?.sprites?.front_default || data?.sprites?.other?.["official-artwork"]?.front_default;
  return { data, types, spriteUrl, name: data.name };
}

async function fetchSpecies(pokeId: number) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokeId}`);
  return res.json();
}

// Heuristic rarity tiering based on species flags and capture_rate
function classifyRarity(species: any): SpawnRarity {
  if (species?.is_legendary || species?.is_mythical) return "legendary";
  const rate = species?.capture_rate ?? 45; // 0-255 higher = easier
  if (rate >= 140) return "common"; // easy to catch
  if (rate >= 70) return "rare";
  return "legendary";
}

export class SpawnManager extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private tileSize: number;
  private mapWidthTiles: number;
  private mapHeightTiles: number;
  private zones: ReturnType<typeof generateZones> = [];
  private zoneCols = 0;
  private zoneRows = 0;
  private active: Map<string, SpawnRecord> = new Map();
  private currentZone = { col: 0, row: 0, id: "0,0" };
  private spawnTimer?: Phaser.Time.TimerEvent;
  private overrideTypes: string[] | null = null;

  constructor(scene: Phaser.Scene, tileSize: number, mapWidthTiles: number, mapHeightTiles: number) {
    super();
    this.scene = scene;
    this.tileSize = tileSize;
    this.mapWidthTiles = mapWidthTiles;
    this.mapHeightTiles = mapHeightTiles;

    this.zoneCols = Math.max(1, Math.floor(mapWidthTiles / ZONE_TILES));
    this.zoneRows = Math.max(1, Math.floor(mapHeightTiles / ZONE_TILES));
    this.zones = generateZones(this.zoneCols, this.zoneRows);
  }

  getActiveSpawns() { return Array.from(this.active.values()); }
  getZoneGrid() { return { cols: this.zoneCols, rows: this.zoneRows, zones: this.zones }; }
  getCurrentZone() { return this.currentZone; }
  setOverrideTypes(types: string[] | null) { this.overrideTypes = types; this.topUpSpawns(true); }

  updatePlayerPos(x: number, y: number) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    const z = getZoneForTile(tx, ty, this.zoneCols, this.zoneRows);
    if (z.id !== this.currentZone.id) {
      this.currentZone = z;
      this.emit("zoneChanged", z);
      // on zone change, try to top up spawns immediately
      this.topUpSpawns(true);
    }
  }

  start() {
    this.topUpSpawns(true);
    this.spawnTimer?.remove(false);
    this.spawnTimer = this.scene.time.addEvent({ delay: 3500, loop: true, callback: () => this.topUpSpawns(false) });
  }

  stop() {
    this.spawnTimer?.remove(false);
    this.active.forEach(r => this.despawn(r.key));
    this.active.clear();
  }

  private async topUpSpawns(immediate: boolean) {
    if (this.active.size >= MAX_ACTIVE) return;
    const need = Math.min(MAX_ACTIVE - this.active.size, 2); // spawn up to 2 at a time
    for (let i = 0; i < need; i++) {
      try { await this.spawnOne(); } catch { /* ignore transient */ }
      if (!immediate) break;
    }
  }

  private getCandidateZones() {
    const around = getAdjacentZoneCoords(this.currentZone.col, this.currentZone.row, this.zoneCols, this.zoneRows, 1);
    return around;
  }

  private pickZoneArea(zone: { col: number; row: number }) {
    const startX = zone.col * ZONE_TILES * this.tileSize;
    const startY = zone.row * ZONE_TILES * this.tileSize;
    const endX = startX + ZONE_TILES * this.tileSize;
    const endY = startY + ZONE_TILES * this.tileSize;
    return { startX, startY, endX, endY };
  }

  private async spawnOne() {
    const zones = this.getCandidateZones();
    const picked = Phaser.Utils.Array.GetRandom(zones);
    const zoneMeta = this.zones.find(z => z.id === picked.id)!;
    const biome: Biome = zoneMeta.biome as any;
    const types = this.overrideTypes || BIOME_TYPE_POOLS[biome];

    // rarity target
    const target = pickRarity();

    // Try several random ids until we find one that matches biome + rarity
    let chosen: { id: number; name: string; spriteUrl: string; types: string[] } | null = null;
    for (let tries = 0; tries < 12; tries++) {
      const id = Phaser.Math.Between(1, 898);
      const p = await fetchPokemon(id);
      if (!p.spriteUrl) continue;
      if (!p.types.some(t => types.includes(t))) continue; // not matching biome
      const species = await fetchSpecies(id);
      const r = classifyRarity(species);
      if (r !== target && Math.random() > 0.35) continue; // allow some bleed-over so we don't loop forever
      chosen = { id, name: p.name, spriteUrl: p.spriteUrl, types: p.types };
      break;
    }
    if (!chosen) return;

    const area = this.pickZoneArea(picked);
    const x = Phaser.Math.Between(area.startX + 12, area.endX - 12);
    const y = Phaser.Math.Between(area.startY + 12, area.endY - 12);

    const key = `spawn-${chosen.id}-${Date.now()}`;
    const sprite = this.scene.add.image(x, y, `pkmn-${chosen.id}`).setVisible(false);
    if (!this.scene.textures.exists(`pkmn-${chosen.id}`)) {
      await new Promise<void>((resolve) => {
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.scene.load.image(`pkmn-${chosen.id}`, chosen!.spriteUrl);
        this.scene.load.start();
      });
      sprite.setTexture(`pkmn-${chosen.id}`);
    }

    sprite.setDepth(20).setInteractive({ useHandCursor: true });
    sprite.setScale(0.1).setAlpha(0);
    sprite.on("pointerdown", () => this.emit("spawnClicked", key));

    // emerge animation
    sprite.setVisible(true);
    this.scene.tweens.add({ targets: sprite, alpha: 1, scale: 1.2, duration: 300, yoyo: true, ease: "sine.out", onComplete: () => sprite.setScale(1) });

    const rec: SpawnRecord = {
      key,
      name: chosen.name,
      pokeId: chosen.id,
      types: chosen.types,
      spriteUrl: chosen.spriteUrl,
      position: { x, y },
      zone: picked,
      sprite,
    };

    // despawn after 60s with fade out
    rec.timeout = this.scene.time.delayedCall(60000, () => this.despawn(key));

    this.active.set(key, rec);
    this.emit("spawned", rec);
  }

  despawn(key: string) {
    const rec = this.active.get(key);
    if (!rec) return;
    if (rec.timeout) rec.timeout.remove(false);
    if (rec.sprite) {
      this.scene.tweens.add({ targets: rec.sprite, alpha: 0, duration: 400, onComplete: () => rec.sprite?.destroy() });
    }
    this.emit("despawned", key);
    this.active.delete(key);
  }
}
