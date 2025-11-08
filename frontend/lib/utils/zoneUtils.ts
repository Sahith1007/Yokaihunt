// Zone calculation utilities for region-based multiplayer (frontend)

// Zone size in tiles (10x10 chunks)
export const ZONE_SIZE_TILES = 10;

/**
 * Calculate zone ID from world coordinates
 * @param x - World X coordinate (in pixels)
 * @param y - World Y coordinate (in pixels)
 * @param tileSize - Size of each tile in pixels (default: 32)
 * @returns Zone ID in format "zone_X_Y"
 */
export function getZoneId(x: number, y: number, tileSize: number = 32): string {
  const tileX = Math.floor(x / tileSize);
  const tileY = Math.floor(y / tileSize);
  const zoneX = Math.floor(tileX / ZONE_SIZE_TILES);
  const zoneY = Math.floor(tileY / ZONE_SIZE_TILES);
  return `zone_${zoneX}_${zoneY}`;
}

/**
 * Get zone coordinates from zone ID
 * @param zoneId - Zone ID (e.g., "zone_3_4")
 * @returns Zone coordinates
 */
export function parseZoneId(zoneId: string): { x: number; y: number } {
  const parts = zoneId.split('_');
  if (parts.length !== 3 || parts[0] !== 'zone') {
    return { x: 0, y: 0 };
  }
  return {
    x: parseInt(parts[1], 10) || 0,
    y: parseInt(parts[2], 10) || 0
  };
}

/**
 * Get all adjacent zone IDs (for cross-zone visibility)
 * @param zoneId - Current zone ID
 * @returns Array of adjacent zone IDs including current
 */
export function getAdjacentZones(zoneId: string): string[] {
  const { x, y } = parseZoneId(zoneId);
  const zones: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      zones.push(`zone_${x + dx}_${y + dy}`);
    }
  }
  return zones;
}

/**
 * Check if two coordinates are in the same zone
 */
export function isSameZone(x1: number, y1: number, x2: number, y2: number, tileSize: number = 32): boolean {
  return getZoneId(x1, y1, tileSize) === getZoneId(x2, y2, tileSize);
}

