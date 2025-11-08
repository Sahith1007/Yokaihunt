// Zone calculation utilities for region-based multiplayer

// Zone size in tiles (10x10 chunks)
export const ZONE_SIZE_TILES = 10;

/**
 * Calculate zone ID from world coordinates
 * @param {number} x - World X coordinate (in pixels)
 * @param {number} y - World Y coordinate (in pixels)
 * @param {number} tileSize - Size of each tile in pixels (default: 32)
 * @returns {string} Zone ID in format "zone_X_Y"
 */
export function getZoneId(x, y, tileSize = 32) {
  const tileX = Math.floor(x / tileSize);
  const tileY = Math.floor(y / tileSize);
  const zoneX = Math.floor(tileX / ZONE_SIZE_TILES);
  const zoneY = Math.floor(tileY / ZONE_SIZE_TILES);
  return `zone_${zoneX}_${zoneY}`;
}

/**
 * Get zone coordinates from zone ID
 * @param {string} zoneId - Zone ID (e.g., "zone_3_4")
 * @returns {{x: number, y: number}} Zone coordinates
 */
export function parseZoneId(zoneId) {
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
 * @param {string} zoneId - Current zone ID
 * @returns {string[]} Array of adjacent zone IDs including current
 */
export function getAdjacentZones(zoneId) {
  const { x, y } = parseZoneId(zoneId);
  const zones = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      zones.push(`zone_${x + dx}_${y + dy}`);
    }
  }
  return zones;
}

/**
 * Check if two coordinates are in the same zone
 * @param {number} x1 - First X coordinate
 * @param {number} y1 - First Y coordinate
 * @param {number} x2 - Second X coordinate
 * @param {number} y2 - Second Y coordinate
 * @param {number} tileSize - Tile size in pixels
 * @returns {boolean}
 */
export function isSameZone(x1, y1, x2, y2, tileSize = 32) {
  return getZoneId(x1, y1, tileSize) === getZoneId(x2, y2, tileSize);
}

