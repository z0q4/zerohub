import type { GeographicSearchResult, GeographicSearchResultType } from '../../../shared/geographic-search/geographic-search.types';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { isSupportedGeometry } from '../../../shared/municipal-boundaries/geometry-validation';

export const LOCATION_LEVELS = ['country', 'region', 'city', 'neighbourhood', 'street', 'exact'] as const;
export type LocationLevel = typeof LOCATION_LEVELS[number];
export type SelectedGeographicFeature = GeographicSearchResult & {
  geometry?: GeoJSON.Geometry | null;
  geometryMetadata?: { source: string; license: string; version: string | null };
  aliases?: string[];
  color?: string;
  officialCode?: string;
};
export type LocationSelection = Partial<Record<LocationLevel, SelectedGeographicFeature>>;

export interface LocationProvider {
  search(requestId: string, query: string): Promise<import('../../../shared/geographic-search/geographic-search.types').GeographicSearchResponse>;
  cancel(requestId: string): Promise<boolean>;
}

export { isSupportedGeometry } from '../../../shared/municipal-boundaries/geometry-validation';

export function selectionFeatures(selection: LocationSelection): FeatureCollection<Geometry> {
  const features: Feature<Geometry>[] = [];
  LOCATION_LEVELS.forEach((level, index) => {
    const item = selection[level];
    if (!item) return;
    const geometry = item.geometry ?? (level === 'exact' ? { type: 'Point' as const, coordinates: [item.longitude, item.latitude] } : null);
    if (geometry && isSupportedGeometry(geometry)) features.push({ type: 'Feature', id: level, properties: { level, depth: index, color: item.color && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : null }, geometry });
  });
  return { type: 'FeatureCollection', features };
}

const acceptedTypes: Record<LocationLevel, GeographicSearchResultType[]> = {
  country: ['country'], region: ['region'], city: ['city'],
  neighbourhood: ['neighbourhood'], street: ['street'], exact: ['address', 'poi', 'coordinate'],
};

const parentProperties = ['country', 'region', 'city', 'district', 'street'] as const;
function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function matchesLocationParents(level: LocationLevel, result: GeographicSearchResult, selection: LocationSelection): boolean {
  const index = LOCATION_LEVELS.indexOf(level);
  if (!acceptedTypes[level].includes(result.type)) return false;
  if (level === 'exact' && result.type === 'coordinate' && result.provider === 'local' && result.sourceId === 'user-coordinate') return Boolean(selection.country);
  return LOCATION_LEVELS.slice(0, index).every((parent, parentIndex) => {
    const selected = selection[parent];
    const value = result[parentProperties[parentIndex]];
    return Boolean(selected && value && [selected.name, ...(selected.aliases ?? [])].some((name) => normalized(name) === normalized(value)));
  });
}

export function selectLocationLevel(selection: LocationSelection, level: LocationLevel, result: GeographicSearchResult | null): LocationSelection {
  const index = LOCATION_LEVELS.indexOf(level);
  if (result && !matchesLocationParents(level, result, selection)) return selection;
  const next: LocationSelection = {};
  for (const parent of LOCATION_LEVELS.slice(0, index)) {
    if (selection[parent]) next[parent] = selection[parent];
  }
  if (result) next[level] = result;
  return next;
}
