import type { MultiPolygon, Polygon, Position } from 'geojson';
import type { IntelligenceBounds } from './intelligence-types';
import { isSupportedGeometry } from '../municipal-boundaries/geometry-validation';

type Area = Polygon | MultiPolygon;
function onSegment(point: Position, a: Position, b: Position): boolean {
  const cross = (point[1] - a[1]) * (b[0] - a[0]) - (point[0] - a[0]) * (b[1] - a[1]);
  return Math.abs(cross) < 1e-10 && point[0] >= Math.min(a[0], b[0]) - 1e-10 && point[0] <= Math.max(a[0], b[0]) + 1e-10 && point[1] >= Math.min(a[1], b[1]) - 1e-10 && point[1] <= Math.max(a[1], b[1]) + 1e-10;
}
function inRing(point: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pointInTerritory(point: Position, area: Area): boolean {
  const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
  return polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((ring) => inRing(point, ring)));
}
export function territoryBounds(area: Area): IntelligenceBounds | null {
  if (!isSupportedGeometry(area)) return null;
  const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
  let west = 180, east = -180, south = 90, north = -90;
  for (const polygon of polygons) for (const ring of polygon) for (const [lon, lat] of ring) { west = Math.min(west, lon); east = Math.max(east, lon); south = Math.min(south, lat); north = Math.max(north, lat); }
  if (east - west > 180) return null; // Antimeridian requires split queries, not a world-spanning box.
  return [south, west, north, east];
}
export function isAllowedBounds(value: unknown): value is IntelligenceBounds {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  const [south, west, north, east] = value;
  return south >= -90 && north <= 90 && west >= -180 && east <= 180 && north > south && east > west && north - south <= 1.2 && east - west <= 1.2 && (north - south) * (east - west) <= 0.6;
}
