import type { MultiPolygon, Polygon } from 'geojson';
import { isSupportedGeometry } from '../../../../shared/municipal-boundaries/geometry-validation';
import type { LocationSelection } from '../location-selection';

export type IntelligenceArea = { id: string; name: string; geometry: Polygon | MultiPolygon; source: string };
/** Do not silently query a parent if the selected administrative level lacks geometry. */
export function selectedIntelligenceArea(selection: LocationSelection): IntelligenceArea | null {
  for (const level of ['neighbourhood', 'city', 'region', 'country'] as const) {
    const item = selection[level];
    if (!item) continue;
    const geometry = item.geometry;
    if (item.geometryMetadata && geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') && isSupportedGeometry(geometry)) return { id: `${level}:${item.id}:${item.officialCode ?? ''}`, name: item.name, geometry, source: item.geometryMetadata.source };
    return null;
  }
  return null;
}
