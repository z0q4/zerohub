import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import type { GeographicSearchResult } from '../../../shared/geographic-search/geographic-search.types';
import type { LocationLevel, LocationSelection, SelectedGeographicFeature } from './location-selection';
import { ibgeStateCode, isIbgeMunicipalityCode, normalizeMunicipalityName } from '../../../shared/municipal-boundaries/municipal-boundaries.types';
import { isSupportedGeometry } from '../../../shared/municipal-boundaries/geometry-validation';

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR') : '';
}
function names(feature: Feature, keys: string[]): string[] {
  return keys.map((key) => normalize(feature.properties?.[key])).filter(Boolean);
}
function uniquePolygon(features: Feature[]): Feature<Polygon | MultiPolygon> | null {
  const valid = features.filter((feature): feature is Feature<Polygon | MultiPolygon> =>
    feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon');
  return valid.length === 1 ? valid[0] : null;
}

export function ibgeStateForSelection(selection: LocationSelection): string | null {
  const country = selection.country;
  if (country?.geometryMetadata?.source !== 'Natural Earth (limites simplificados)' || !(country.sourceId === 'BRA' || (country.aliases ?? []).some((value) => normalizeMunicipalityName(value) === 'brazil'))) return null;
  return [selection.region?.name, ...(selection.region?.aliases ?? [])].filter((value): value is string => Boolean(value)).map(ibgeStateCode).find(Boolean) ?? null;
}

/** Only unique, exact name matches within a uniquely resolved parent are accepted. */
export function resolveLocalBoundary(level: LocationLevel, result: GeographicSearchResult, selection: LocationSelection, countries: FeatureCollection, regions: FeatureCollection): SelectedGeographicFeature {
  const candidate = result as SelectedGeographicFeature;
  const stateCode = ibgeStateForSelection(selection);
  if (level === 'city' && stateCode && candidate.geometry && candidate.geometryMetadata?.source === 'IBGE · Malhas municipais' && isIbgeMunicipalityCode(candidate.officialCode, stateCode) && candidate.sourceId === candidate.officialCode && candidate.id === `ibge:municipio:${candidate.officialCode}` && ['Polygon', 'MultiPolygon'].includes(candidate.geometry.type) && isSupportedGeometry(candidate.geometry)) return candidate;
  const countryName = level === 'country' ? result.name : selection.country?.name;
  const country = countryName ? uniquePolygon(countries.features.filter((feature) => names(feature, ['NAME', 'NAME_PT', 'ADMIN']).includes(normalize(countryName)))) : null;
  let boundary: Feature<Polygon | MultiPolygon> | null = null;
  if (level === 'country') boundary = country;
  if (level === 'region' && country) {
    const countryCode = normalize(country.properties?.ISO_A2);
    const countryAdmin = normalize(country.properties?.ADMIN);
    boundary = uniquePolygon(regions.features.filter((feature) =>
      names(feature, ['name', 'name_pt']).includes(normalize(result.name)) &&
      Boolean(countryCode && countryCode !== '-99' && normalize(feature.properties?.iso_a2) === countryCode ||
        countryAdmin && normalize(feature.properties?.admin) === countryAdmin)));
  }
  return boundary ? {
    ...result,
    geometry: boundary.geometry,
    aliases: (level === 'country' ? ['NAME', 'NAME_PT', 'ADMIN'] : ['name', 'name_pt']).map((key) => boundary?.properties?.[key]).filter((value): value is string => typeof value === 'string' && Boolean(value)),
    geometryMetadata: { source: 'Natural Earth (limites simplificados)', license: 'Domínio público', version: null },
  } : { ...result, geometry: null };
}

export function searchLocalBoundaries(level: 'country' | 'region', query: string, selection: LocationSelection, countries: FeatureCollection, regions: FeatureCollection): GeographicSearchResult[] {
  const needle = normalize(query);
  if (needle.length < 3) return [];
  const country = selection.country && uniquePolygon(countries.features.filter((feature) => names(feature, ['NAME', 'NAME_PT', 'ADMIN']).includes(normalize(selection.country?.name))));
  const candidates = level === 'country' ? countries.features : country ? regions.features.filter((feature) => {
    const code = normalize(country.properties?.ISO_A2);
    return Boolean(code && code !== '-99' && normalize(feature.properties?.iso_a2) === code || normalize(country.properties?.ADMIN) && normalize(feature.properties?.admin) === normalize(country.properties?.ADMIN));
  }) : [];
  return candidates.flatMap((feature, index): GeographicSearchResult[] => {
    const label = String(feature.properties?.[level === 'country' ? 'NAME_PT' : 'name_pt'] || feature.properties?.[level === 'country' ? 'NAME' : 'name'] || '');
    const aliases = names(feature, level === 'country' ? ['NAME_PT', 'NAME', 'ADMIN'] : ['name', 'name_pt']);
    if (!aliases.some((name) => name.includes(needle)) || !feature.geometry) return [];
    const bounds = geometryBounds(feature.geometry);
    if (!bounds) return [];
    const longitude = ((bounds[0][0] + bounds[1][0]) / 2 + 540) % 360 - 180;
    const id = String(feature.properties?.[level === 'country' ? 'ISO_A3' : 'adm1_code'] || index);
    return [{ id: `natural-earth:${level}:${id}`, provider: 'local' as const, sourceId: id, name: label, label, type: level, latitude: (bounds[0][1] + bounds[1][1]) / 2, longitude, boundingBox: null, country: level === 'country' ? label : selection.country?.name ?? null, region: level === 'region' ? label : null, city: null, district: null, street: null, houseNumber: null, postalCode: null, attribution: 'Natural Earth · domínio público', approximate: true as const, fetchedAt: new Date().toISOString(), cached: false }];
  }).slice(0, 15);
}

/** Bounds use the shortest longitude interval, including geometries crossing 180°. */
export function geometryBounds(geometry: Geometry): [[number, number], [number, number]] | null {
  if (!('coordinates' in geometry)) return null;
  const points: number[][] = [];
  function visit(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      if (Number.isFinite(value[0]) && Number.isFinite(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90) points.push([value[0], value[1]]);
    } else value.forEach(visit);
  }
  visit(geometry.coordinates);
  if (!points.length) return null;
  const longitude = points.map(([lon]) => (lon + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1, gapIndex = 0;
  for (let i = 0; i < longitude.length; i += 1) {
    const next = i + 1 < longitude.length ? longitude[i + 1] : longitude[0] + 360;
    if (next - longitude[i] > largestGap) { largestGap = next - longitude[i]; gapIndex = i; }
  }
  let west = longitude[(gapIndex + 1) % longitude.length];
  let east = longitude[gapIndex];
  if (east < west) east += 360;
  if (west > 180) { west -= 360; east -= 360; }
  let south = 90, north = -90;
  for (const point of points) { south = Math.min(south, point[1]); north = Math.max(north, point[1]); }
  return [[west, south], [east, north]];
}

/** Bounds are derived only from real coordinates, including geometry collections. */
export function featureCollectionBounds(collection: FeatureCollection): [[number, number], [number, number]] | null {
  const points: number[][] = [];
  function visit(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') points.push([value[0], value[1]]);
    else value.forEach(visit);
  }
  function geometry(value: Geometry | null): void {
    if (!value) return;
    if (value.type === 'GeometryCollection') value.geometries.forEach(geometry);
    else visit(value.coordinates);
  }
  collection.features.forEach((feature) => geometry(feature.geometry));
  return geometryBounds({ type: 'MultiPoint', coordinates: points });
}
