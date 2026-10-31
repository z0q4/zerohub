import type { FeatureCollection } from 'geojson';
import type { GeographicSearchResult, GeographicSearchResultType } from '../../../shared/geographic-search/geographic-search.types';
import { geometryBounds, resolveLocalBoundary } from './location-boundaries';
import { LOCATION_LEVELS } from './location-selection';
import type { LocationLevel, LocationSelection } from './location-selection';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const types: Record<LocationLevel, GeographicSearchResultType> = { country: 'country', region: 'region', city: 'city', neighbourhood: 'neighbourhood', street: 'street', exact: 'address' };

/** Use the deepest saved level; an unresolved child must not zoom to its parent. */
export function restoredLocationCamera(selection: LocationSelection): { bounds: [[number, number], [number, number]]; maxZoom: number } | { center: [number, number]; zoom: number } | null {
  const level = [...LOCATION_LEVELS].reverse().find((candidate) => selection[candidate]);
  if (!level) return null;
  const item = selection[level];
  if (!item) return null;
  const bounds = item.geometry && item.geometry.type !== 'Point' ? geometryBounds(item.geometry) : null;
  const maxZoom = { country: 5, region: 9, city: 11, neighbourhood: 14, street: 16, exact: 16 }[level];
  if (bounds) return { bounds, maxZoom };
  return { center: [item.longitude, item.latitude], zoom: { country: 4, region: 7, city: 10, neighbourhood: 12, street: 15, exact: 15 }[level] };
}

/** Accepts the previous activity format without trusting arbitrary persisted geometry. */
export function restoreSavedLocation(output: unknown, countries: FeatureCollection, regions: FeatureCollection): LocationSelection | null {
  if (!record(output) || !Array.isArray(output.levels) || !output.levels.length || output.levels.length > LOCATION_LEVELS.length) return null;
  const selection: LocationSelection = {};
  let previousIndex = -1;
  for (let index = 0; index < output.levels.length; index += 1) {
    const item = output.levels[index];
    if (!record(item) || typeof item.level !== 'string') return null;
    const levelIndex = LOCATION_LEVELS.findIndex((candidate) => candidate === item.level);
    if (levelIndex <= previousIndex || (index === 0 && levelIndex !== 0)) return null;
    previousIndex = levelIndex;
    const level = LOCATION_LEVELS[levelIndex];
    if (typeof item.id !== 'string' || !item.id || item.id.length > 300 || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || typeof item.latitude !== 'number' || !Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90 || typeof item.longitude !== 'number' || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180 || (item.source !== 'local' && item.source !== 'photon')) return null;
    const storedOsmId = typeof item.sourceId === 'string' && /^[NWR]:\d+$/i.test(item.sourceId) ? item.sourceId : null;
    const oldOsmId = /^photon:([NWR]:\d+)$/i.exec(item.id)?.[1] ?? null;
    const sourceId = level === 'exact' && item.type === 'coordinate' && item.sourceId === 'user-coordinate' ? 'user-coordinate' : item.source === 'photon' ? storedOsmId ?? oldOsmId : item.id.startsWith(`natural-earth:${level}:`) ? item.id.slice(`natural-earth:${level}:`.length) : typeof item.officialCode === 'string' && item.id === `ibge:municipio:${item.officialCode}` ? item.officialCode : null;
    const resultType = sourceId === 'user-coordinate' ? 'coordinate' : level === 'exact' && item.type === 'poi' ? 'poi' : types[level];
    const result: GeographicSearchResult = {
      id: item.id, provider: item.source, sourceId, name: item.name, label: item.name, type: resultType, latitude: item.latitude, longitude: item.longitude, boundingBox: null,
      country: level === 'country' ? item.name : selection.country?.name ?? null,
      region: level === 'region' ? item.name : selection.region?.name ?? null,
      city: level === 'city' ? item.name : selection.city?.name ?? null,
      district: level === 'neighbourhood' ? item.name : selection.neighbourhood?.name ?? null,
      street: level === 'street' ? item.name : selection.street?.name ?? null,
      houseNumber: null, postalCode: null, attribution: sourceId === 'user-coordinate' ? 'Coordenada informada pelo usuário; relação com a hierarquia não verificada' : item.source === 'local' ? 'Natural Earth · domínio público' : '© OpenStreetMap contributors · Photon', approximate: true, fetchedAt: new Date().toISOString(), cached: false,
    };
    const resolved = resolveLocalBoundary(level, result, selection, countries, regions);
    if (typeof item.officialCode === 'string' && ((level === 'city' && /^\d{7}$/.test(item.officialCode)) || ((level === 'neighbourhood' || level === 'street') && /^\d{1,8}$/.test(item.officialCode)))) resolved.officialCode = item.officialCode;
    selection[level] = resolved;
  }
  return selection;
}
