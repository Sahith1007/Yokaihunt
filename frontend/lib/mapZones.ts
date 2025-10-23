export type Biome = "grassland" | "cave" | "beach" | "city" | "mountain" | "lake" | "desert" | "forest" | "snowfield";

export const ZONE_TILES = 10; // 10x10 tiles per zone

export interface Zone {
  id: string; // "c,r"
  col: number;
  row: number;
  biome: Biome;
}

// Simple deterministic biome layout over an R x C grid
export function generateZones(cols: number, rows: number): Zone[] {
  const zones: Zone[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let biome: Biome = "grassland";
      const edge = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
      if (r === 0) biome = "mountain"; // top ridge
      else if (r === rows - 1) biome = "beach"; // bottom shore
      else if ((r === Math.floor(rows / 2) || r === Math.floor(rows / 2) - 1) &&
               (c === Math.floor(cols / 2) || c === Math.floor(cols / 2) - 1)) biome = "lake"; // 2x2 lake
      else if (edge && (r === 1 || c === 1 || r === rows - 2 || c === cols - 2)) biome = "cave"; // near edges
      else if ((r + c) % 9 === 0) biome = "city"; // a few city blocks
      else if ((r + 2 * c) % 6 === 0) biome = "forest";
      else if (r % 5 === 0 && c % 3 === 0) biome = "desert";
      else if ((r - c) % 8 === 0) biome = "snowfield";
      else biome = "grassland";

      zones.push({ id: `${c},${r}`, col: c, row: r, biome });
    }
  }
  return zones;
}

export function getZoneForTile(tileX: number, tileY: number, zoneCols: number, zoneRows: number): { col: number; row: number; id: string } {
  const col = Math.max(0, Math.min(zoneCols - 1, Math.floor(tileX / ZONE_TILES)));
  const row = Math.max(0, Math.min(zoneRows - 1, Math.floor(tileY / ZONE_TILES)));
  return { col, row, id: `${col},${row}` };
}

export function getAdjacentZoneCoords(col: number, row: number, zoneCols: number, zoneRows: number, radius = 1) {
  const out: { col: number; row: number; id: string }[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nc = col + dx; const nr = row + dy;
      if (nc < 0 || nr < 0 || nc >= zoneCols || nr >= zoneRows) continue;
      out.push({ col: nc, row: nr, id: `${nc},${nr}` });
    }
  }
  return out;
}

export const BIOME_TYPE_POOLS: Record<Biome, string[]> = {
  grassland: ["grass", "bug", "normal", "flying"],
  cave: ["rock", "ground", "poison", "dark"],
  beach: ["water", "flying"],
  city: ["electric", "normal", "steel", "fighting"],
  mountain: ["rock", "ground", "ice", "dragon"],
  lake: ["water", "dragon", "fairy"],
  desert: ["ground", "rock", "fire"],
  forest: ["grass", "bug", "fairy"],
  snowfield: ["ice", "water", "fairy"],
};
