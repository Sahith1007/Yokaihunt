import * as Phaser from "phaser";
import { BIOME_TYPE_POOLS, ZONE_TILES, generateZones, getAdjacentZoneCoords, getZoneForTile, type Biome } from "./mapZones";

export type SpawnRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

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
  level: number;
  rarity: SpawnRarity;
};

const MAX_ACTIVE = 8; // 7-8 active Pokemon per 10x10 grid area

// Weighted rarity distribution (as per requirements)
const RARITY_WEIGHTS: Record<SpawnRarity, number> = {
  common: 0.60,      // 60%
  uncommon: 0.25,    // 25%
  rare: 0.10,        // 10%
  epic: 0.04,        // 4%
  legendary: 0.01,   // 1%
};

// Legendary Pokemon IDs (require level >= 20)
const LEGENDARY_IDS = [
  // Gen 1
  144, 145, 146, // Articuno, Zapdos, Moltres
  150, 151, // Mewtwo, Mew
  // Gen 2
  243, 244, 245, // Raikou, Entei, Suicune
  249, 250, 251, // Lugia, Ho-Oh, Celebi
  // Gen 3
  377, 378, 379, // Regirock, Regice, Registeel
  380, 381, 382, 383, 384, // Latias, Latios, Kyogre, Groudon, Rayquaza
  385, 386, // Jirachi, Deoxys
  // Gen 4
  480, 481, 482, // Uxie, Mesprit, Azelf
  483, 484, 487, 488, 489, 490, 491, // Dialga, Palkia, Giratina, Cresselia, Phione, Manaphy, Darkrai
];

// Mythical Pokemon (also require level >= 20)
const MYTHICAL_IDS = [151, 251, 385, 386, 489, 490, 491, 492, 493, 494];

// Common Pokemon by type - Complete list from all generations
const COMMON_POKEMON_BY_TYPE: Record<string, number[]> = {
  // Normal type - Common across all generations
  normal: [
    16,   // Pidgey (Gen 1)
    19,   // Rattata (Gen 1)
    161,  // Sentret (Gen 2)
    163,  // Hoothoot (Gen 2)
    263,  // Zigzagoon (Gen 3)
    396,  // Starly (Gen 4)
    399,  // Bidoof (Gen 4)
    504,  // Patrat (Gen 5)
    506,  // Lillipup (Gen 5)
    519,  // Pidove (Gen 5)
    659,  // Bunnelby (Gen 6)
    734,  // Yungoos (Gen 7)
    819,  // Skwovet (Gen 8)
  ],
  
  // Grass type - Common starters and wild Pokemon
  grass: [
    1,    // Bulbasaur (Gen 1)
    43,   // Oddish (Gen 1)
    69,   // Bellsprout (Gen 1)
    102,  // Exeggcute (Gen 1)
    152,  // Chikorita (Gen 2)
    187,  // Hoppip (Gen 2)
    252,  // Treecko (Gen 3)
    285,  // Shroomish (Gen 3)
    387,  // Turtwig (Gen 4)
    495,  // Snivy (Gen 5)
    548,  // Petilil (Gen 5)
    650,  // Chespin (Gen 6)
    672,  // Skiddo (Gen 6)
    722,  // Rowlet (Gen 7)
    810,  // Grookey (Gen 8)
  ],
  
  // Bug type - Most common type in Pokemon games
  bug: [
    10,   // Caterpie (Gen 1)
    11,   // Metapod (Gen 1)
    13,   // Weedle (Gen 1)
    14,   // Kakuna (Gen 1)
    165,  // Ledyba (Gen 2)
    167,  // Spinarak (Gen 2)
    265,  // Wurmple (Gen 3)
    266,  // Silcoon (Gen 3)
    268,  // Cascoon (Gen 3)
    290,  // Nincada (Gen 3)
    412,  // Burmy (Gen 4)
    540,  // Sewaddle (Gen 5)
    595,  // Joltik (Gen 5)
    664,  // Scatterbug (Gen 6)
    736,  // Grubbin (Gen 7)
    824,  // Blipbug (Gen 8)
  ],
  
  // Flying type - Birds and common flyers
  flying: [
    16,   // Pidgey (Gen 1)
    21,   // Spearow (Gen 1)
    41,   // Zubat (Gen 1)
    163,  // Hoothoot (Gen 2)
    276,  // Taillow (Gen 3)
    278,  // Wingull (Gen 3)
    396,  // Starly (Gen 4)
    519,  // Pidove (Gen 5)
    521,  // Unfezant (Gen 5)
    661,  // Fletchling (Gen 6)
    714,  // Noibat (Gen 6)
    731,  // Pikipek (Gen 7)
    821,  // Rookidee (Gen 8)
  ],
  
  // Water type - Common water Pokemon
  water: [
    7,    // Squirtle (Gen 1)
    54,   // Psyduck (Gen 1)
    60,   // Poliwag (Gen 1)
    72,   // Tentacool (Gen 1)
    116,  // Horsea (Gen 1)
    118,  // Goldeen (Gen 1)
    129,  // Magikarp (Gen 1)
    158,  // Totodile (Gen 2)
    183,  // Marill (Gen 2)
    258,  // Mudkip (Gen 3)
    318,  // Carvanha (Gen 3)
    393,  // Piplup (Gen 4)
    456,  // Finneon (Gen 4)
    501,  // Oshawott (Gen 5)
    550,  // Basculin (Gen 5)
    656,  // Froakie (Gen 6)
    728,  // Popplio (Gen 7)
    771,  // Pyukumuku (Gen 7)
    816,  // Sobble (Gen 8)
  ],
  
  // Fire type - Common fire Pokemon
  fire: [
    4,    // Charmander (Gen 1)
    37,   // Vulpix (Gen 1)
    58,   // Growlithe (Gen 1)
    77,   // Ponyta (Gen 1)
    155,  // Cyndaquil (Gen 2)
    218,  // Slugma (Gen 2)
    255,  // Torchic (Gen 3)
    322,  // Numel (Gen 3)
    390,  // Chimchar (Gen 4)
    498,  // Tepig (Gen 5)
    513,  // Pansear (Gen 5)
    653,  // Fennekin (Gen 6)
    725,  // Litten (Gen 7)
    813,  // Scorbunny (Gen 8)
  ],
  
  // Electric type - Common electric Pokemon
  electric: [
    25,   // Pikachu (Gen 1)
    81,   // Magnemite (Gen 1)
    100,  // Voltorb (Gen 1)
    172,  // Pichu (Gen 2)
    179,  // Mareep (Gen 2)
    309,  // Electrike (Gen 3)
    311,  // Plusle (Gen 3)
    312,  // Minun (Gen 3)
    403,  // Shinx (Gen 4)
    417,  // Pachirisu (Gen 4)
    522,  // Blitzle (Gen 5)
    587,  // Emolga (Gen 5)
    702,  // Dedenne (Gen 6)
    777,  // Togedemaru (Gen 7)
    835,  // Yamper (Gen 8)
  ],
  
  // Rock type - Common rock Pokemon
  rock: [
    74,   // Geodude (Gen 1)
    95,   // Onix (Gen 1)
    138,  // Omanyte (Gen 1)
    140,  // Kabuto (Gen 1)
    213,  // Shuckle (Gen 2)
    299,  // Nosepass (Gen 3)
    304,  // Aron (Gen 3)
    408,  // Cranidos (Gen 4)
    410,  // Shieldon (Gen 4)
    524,  // Roggenrola (Gen 5)
    557,  // Dwebble (Gen 5)
    688,  // Binacle (Gen 6)
    696,  // Tyrunt (Gen 6)
    744,  // Rockruff (Gen 7)
    837,  // Rolycoly (Gen 8)
  ],
  
  // Ground type - Common ground Pokemon
  ground: [
    27,   // Sandshrew (Gen 1)
    50,   // Diglett (Gen 1)
    104,  // Cubone (Gen 1)
    207,  // Gligar (Gen 2)
    231,  // Phanpy (Gen 2)
    328,  // Trapinch (Gen 3)
    449,  // Hippopotas (Gen 4)
    529,  // Drilbur (Gen 5)
    551,  // Sandile (Gen 5)
    659,  // Bunnelby (Gen 6)
    749,  // Mudbray (Gen 7)
    843,  // Silicobra (Gen 8)
  ],
  
  // Poison type - Common poison Pokemon
  poison: [
    23,   // Ekans (Gen 1)
    29,   // Nidoran♀ (Gen 1)
    32,   // Nidoran♂ (Gen 1)
    41,   // Zubat (Gen 1)
    88,   // Grimer (Gen 1)
    109,  // Koffing (Gen 1)
    316,  // Gulpin (Gen 3)
    336,  // Seviper (Gen 3)
    451,  // Skorupi (Gen 4)
    453,  // Croagunk (Gen 4)
    543,  // Venipede (Gen 5)
    568,  // Trubbish (Gen 5)
    757,  // Salandit (Gen 7)
    848,  // Toxel (Gen 8)
  ],
  
  // Fighting type - Common fighting Pokemon
  fighting: [
    56,   // Mankey (Gen 1)
    66,   // Machop (Gen 1)
    236,  // Tyrogue (Gen 2)
    296,  // Makuhita (Gen 3)
    307,  // Meditite (Gen 3)
    447,  // Riolu (Gen 4)
    532,  // Timburr (Gen 5)
    538,  // Throh (Gen 5)
    539,  // Sawk (Gen 5)
    674,  // Pancham (Gen 6)
    739,  // Crabrawler (Gen 7)
    759,  // Stufful (Gen 7)
  ],
  
  // Psychic type - Common psychic Pokemon
  psychic: [
    63,   // Abra (Gen 1)
    96,   // Drowzee (Gen 1)
    122,  // Mr. Mime (Gen 1)
    177,  // Natu (Gen 2)
    280,  // Ralts (Gen 3)
    307,  // Meditite (Gen 3)
    433,  // Chingling (Gen 4)
    517,  // Munna (Gen 5)
    527,  // Woobat (Gen 5)
    605,  // Elgyem (Gen 5)
    677,  // Espurr (Gen 6)
    765,  // Oranguru (Gen 7)
    856,  // Hatenna (Gen 8)
  ],
  
  // Ice type - Common ice Pokemon
  ice: [
    86,   // Seel (Gen 1)
    215,  // Sneasel (Gen 2)
    220,  // Swinub (Gen 2)
    361,  // Snorunt (Gen 3)
    363,  // Spheal (Gen 3)
    459,  // Snover (Gen 4)
    582,  // Vanillite (Gen 5)
    613,  // Cubchoo (Gen 5)
    712,  // Bergmite (Gen 6)
    872,  // Snom (Gen 8)
  ],
  
  // Ghost type - Common ghost Pokemon
  ghost: [
    92,   // Gastly (Gen 1)
    200,  // Misdreavus (Gen 2)
    353,  // Shuppet (Gen 3)
    355,  // Duskull (Gen 3)
    425,  // Drifloon (Gen 4)
    562,  // Yamask (Gen 5)
    607,  // Litwick (Gen 5)
    708,  // Phantump (Gen 6)
    710,  // Pumpkaboo (Gen 6)
    778,  // Mimikyu (Gen 7)
    854,  // Sinistea (Gen 8)
  ],
  
  // Dragon type - Less common but still available
  dragon: [
    147,  // Dratini (Gen 1)
    371,  // Bagon (Gen 3)
    443,  // Gible (Gen 4)
    610,  // Axew (Gen 5)
    633,  // Deino (Gen 5)
    704,  // Goomy (Gen 6)
    780,  // Drampa (Gen 7)
    782,  // Jangmo-o (Gen 7)
    884,  // Duraludon (Gen 8)
  ],
  
  // Dark type - Common dark Pokemon
  dark: [
    198,  // Murkrow (Gen 2)
    228,  // Houndour (Gen 2)
    261,  // Poochyena (Gen 3)
    302,  // Sableye (Gen 3)
    434,  // Stunky (Gen 4)
    509,  // Purrloin (Gen 5)
    624,  // Pawniard (Gen 5)
    629,  // Vullaby (Gen 5)
    686,  // Inkay (Gen 6)
    827,  // Nickit (Gen 8)
    859,  // Impidimp (Gen 8)
  ],
  
  // Steel type - Common steel Pokemon
  steel: [
    81,   // Magnemite (Gen 1)
    95,   // Onix (Gen 1)
    304,  // Aron (Gen 3)
    436,  // Bronzor (Gen 4)
    597,  // Ferroseed (Gen 5)
    599,  // Klink (Gen 5)
    707,  // Klefki (Gen 6)
    808,  // Meltan (Gen 7)
    878,  // Cufant (Gen 8)
  ],
  
  // Fairy type - Common fairy Pokemon (Gen 6+)
  fairy: [
    35,   // Clefairy (Gen 1)
    39,   // Jigglypuff (Gen 1)
    174,  // Igglybuff (Gen 2)
    183,  // Marill (Gen 2)
    280,  // Ralts (Gen 3)
    439,  // Mime Jr. (Gen 4)
    546,  // Cottonee (Gen 5)
    682,  // Spritzee (Gen 6)
    684,  // Swirlix (Gen 6)
    702,  // Dedenne (Gen 6)
    868,  // Milcery (Gen 8)
  ],
};

// Get common IDs for type
function getCommonIdsForType(type: string): number[] {
  return COMMON_POKEMON_BY_TYPE[type] || [16, 19, 43]; // Default to Pidgey, Rattata, Caterpie
}

/**
 * Pick rarity based on weighted distribution and trainer level
 */
function pickRarity(trainerLevel: number): SpawnRarity {
  const r = Math.random();
  let cumulative = 0;
  
  // Legendary/Mythic require trainer level >= 20
  const canSpawnLegendary = trainerLevel >= 20;
  
  // Adjust weights if legendary not available
  const weights = { ...RARITY_WEIGHTS };
  if (!canSpawnLegendary) {
    // Redistribute legendary weight to other rarities
    const redistribution = weights.legendary / 4;
    weights.common += redistribution;
    weights.uncommon += redistribution;
    weights.rare += redistribution;
    weights.epic += redistribution;
    weights.legendary = 0;
  }
  
  // Slightly increase better spawn chances with level
  const levelBonus = Math.min(trainerLevel * 0.005, 0.1); // Max 10% bonus at level 20
  weights.rare += levelBonus;
  weights.epic += levelBonus / 2;
  weights.common -= levelBonus * 1.5; // Reduce common spawns
  
  for (const [rarity, weight] of Object.entries(weights) as [SpawnRarity, number][]) {
    cumulative += weight;
    if (r < cumulative) return rarity;
  }
  
  return "common";
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
function classifyRarity(species: any, pokeId: number): SpawnRarity {
  // Check if legendary or mythical
  if (LEGENDARY_IDS.includes(pokeId) || MYTHICAL_IDS.includes(pokeId)) return "legendary";
  if (species?.is_legendary || species?.is_mythical) return "legendary";
  
  const rate = species?.capture_rate ?? 45; // 0-255 higher = easier
  
  // Classify based on capture rate
  if (rate >= 200) return "common";     // Very easy
  if (rate >= 120) return "uncommon";   // Easy
  if (rate >= 75) return "rare";        // Moderate
  if (rate >= 45) return "epic";        // Hard
  return "legendary";                   // Very hard
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
  private trainerLevel: number = 1; // Trainer level for spawn balancing

  constructor(scene: Phaser.Scene, tileSize: number, mapWidthTiles: number, mapHeightTiles: number, trainerLevel: number = 1) {
    super();
    this.scene = scene;
    this.tileSize = tileSize;
    this.mapWidthTiles = mapWidthTiles;
    this.mapHeightTiles = mapHeightTiles;
    this.trainerLevel = trainerLevel;

    this.zoneCols = Math.max(1, Math.floor(mapWidthTiles / ZONE_TILES));
    this.zoneRows = Math.max(1, Math.floor(mapHeightTiles / ZONE_TILES));
    this.zones = generateZones(this.zoneCols, this.zoneRows);
  }

  getActiveSpawns() { return Array.from(this.active.values()); }
  getZoneGrid() { return { cols: this.zoneCols, rows: this.zoneRows, zones: this.zones }; }
  getCurrentZone() { return this.currentZone; }
  setOverrideTypes(types: string[] | null) { this.overrideTypes = types; this.topUpSpawns(true); }
  setTrainerLevel(level: number) { this.trainerLevel = level; }

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
    const scheduleNext = () => {
      const delay = Phaser.Math.Between(20000, 40000);
      this.spawnTimer = this.scene.time.addEvent({ delay, loop: false, callback: () => {
        this.topUpSpawns(false);
        scheduleNext();
      }});
    };
    scheduleNext();
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

    // Pick rarity target based on trainer level
    const target = pickRarity(this.trainerLevel);

    // For common spawns, prioritize common Pokemon IDs
    let chosen: { id: number; name: string; spriteUrl: string; types: string[]; rarity: SpawnRarity } | null = null;
    
    if (target === "common") {
      // Try to spawn common Pokemon first
      const typeToUse = Phaser.Utils.Array.GetRandom(types);
      const commonIds = getCommonIdsForType(typeToUse);
      const id = Phaser.Utils.Array.GetRandom(commonIds);
      
      try {
        const p = await fetchPokemon(id);
        if (p.spriteUrl) {
          const species = await fetchSpecies(id);
          const rarity = classifyRarity(species, id);
          chosen = { id, name: p.name, spriteUrl: p.spriteUrl, types: p.types, rarity };
        }
      } catch {}
    }
    
    // If common failed or targeting other rarity, use random search
    if (!chosen) {
      for (let tries = 0; tries < 15; tries++) {
        let id = Phaser.Math.Between(1, 898);
        
        // For legendary target, only check legendary IDs if trainer level allows
        if (target === "legendary" && this.trainerLevel >= 20) {
          id = Phaser.Utils.Array.GetRandom([...LEGENDARY_IDS, ...MYTHICAL_IDS]);
        }
        
        const p = await fetchPokemon(id);
        if (!p.spriteUrl) continue;
        if (!p.types.some(t => types.includes(t))) continue; // not matching biome
        
        const species = await fetchSpecies(id);
        const r = classifyRarity(species, id);
        
        // Allow some flexibility in rarity matching
        if (r !== target && Math.random() > 0.3) continue;
        
        chosen = { id, name: p.name, spriteUrl: p.spriteUrl, types: p.types, rarity: r };
        break;
      }
    }
    if (!chosen) return;

    const area = this.pickZoneArea(picked);
    const x = Phaser.Math.Between(area.startX + 12, area.endX - 12);
    const y = Phaser.Math.Between(area.startY + 12, area.endY - 12);

    // Calculate Pokemon level based on trainer level and rarity
    const baseLevel = Math.max(1, this.trainerLevel - 2 + Phaser.Math.Between(-1, 3));
    const rarityBonus = chosen.rarity === "legendary" ? 5 : chosen.rarity === "epic" ? 3 : chosen.rarity === "rare" ? 2 : 0;
    const pokemonLevel = Math.max(1, baseLevel + rarityBonus);

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

    // emerge animation - vary by rarity
    sprite.setVisible(true);
    const scaleFactor = chosen.rarity === "legendary" ? 1.5 : chosen.rarity === "epic" ? 1.3 : 1.2;
    this.scene.tweens.add({ 
      targets: sprite, 
      alpha: 1, 
      scale: scaleFactor, 
      duration: 300, 
      yoyo: true, 
      ease: "sine.out", 
      onComplete: () => sprite.setScale(chosen.rarity === "legendary" ? 1.2 : 1) 
    });

    const rec: SpawnRecord = {
      key,
      name: chosen.name,
      pokeId: chosen.id,
      types: chosen.types,
      spriteUrl: chosen.spriteUrl,
      position: { x, y },
      zone: picked,
      sprite,
      level: pokemonLevel,
      rarity: chosen.rarity,
    };

    // despawn after time based on rarity (legendary lasts longer)
    const despawnTime = chosen.rarity === "legendary" ? 90000 : chosen.rarity === "epic" ? 75000 : 60000;
    rec.timeout = this.scene.time.delayedCall(despawnTime, () => this.despawn(key));

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
