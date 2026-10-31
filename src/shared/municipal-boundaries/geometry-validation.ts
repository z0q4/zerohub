import type { Geometry } from 'geojson';

export function isSupportedGeometry(geometry: Geometry): boolean {
  const point = (value: unknown): value is number[] => Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number' && Number.isFinite(value[0]) && Number.isFinite(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
  const line = (value: unknown, minimum: number): value is number[][] => Array.isArray(value) && value.length >= minimum && value.every(point);
  const ring = (value: unknown): boolean => line(value, 4) && value[0][0] === value[value.length - 1][0] && value[0][1] === value[value.length - 1][1];
  const polygon = (value: unknown): boolean => Array.isArray(value) && value.length > 0 && value.every(ring);
  switch (geometry.type) {
    case 'Point': return point(geometry.coordinates);
    case 'LineString': return line(geometry.coordinates, 2);
    case 'MultiLineString': return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every((item) => line(item, 2));
    case 'Polygon': return polygon(geometry.coordinates);
    case 'MultiPolygon': return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(polygon);
    default: return false;
  }
}
