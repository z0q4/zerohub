import type { LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import { isSupportedGeometry } from '../municipal-boundaries/geometry-validation';
import { normalizeMunicipalityName } from '../municipal-boundaries/municipal-boundaries.types';
import type { RecifeNeighborhood, RecifeStreet } from './recife-geometry.types';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const code = (value: unknown): string | null => /^\d{1,8}$/.test(String(value)) && Number(value) > 0 ? String(value) : null;
function features(payload: unknown, limit: number): unknown[] {
  if (!record(payload) || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) || payload.features.length > limit) throw new Error('Conjunto geográfico do Recife inválido.');
  return payload.features;
}

export function parseRecifeNeighborhoods(payload: unknown): RecifeNeighborhood[] {
  return features(payload, 1000).flatMap((item): RecifeNeighborhood[] => {
    if (!record(item) || !record(item.properties) || !record(item.geometry)) return [];
    const id = code(item.properties.CBAIRRCODI);
    const name = item.properties.EBAIRRNOMEOF || item.properties.EBAIRRNOME;
    if (!id || typeof name !== 'string' || !name.trim() || name.length > 160 || !['Polygon', 'MultiPolygon'].includes(String(item.geometry.type))) return [];
    const geometry = item.geometry as unknown as Polygon | MultiPolygon;
    return isSupportedGeometry(geometry) ? [{ code: id, name: name.trim(), geometry, version: '2023' }] : [];
  });
}

export function matchRecifeNeighborhood(items: readonly RecifeNeighborhood[], name: string, savedCode?: string): RecifeNeighborhood | null {
  const found = items.filter((item) => normalizeMunicipalityName(item.name) === normalizeMunicipalityName(name) && (!savedCode || item.code === savedCode));
  return found.length === 1 ? found[0] : null;
}

export function findRecifeStreetCode(payload: unknown, neighborhoodCode: string, name: string): string | null {
  if (!record(payload) || payload.success !== true || !record(payload.result) || !Array.isArray(payload.result.records) || typeof payload.result.total !== 'number' || payload.result.total > 1000 || payload.result.records.length !== payload.result.total) throw new Error('Relação de ruas e bairros incompleta ou inválida.');
  const codes = new Set<string>();
  for (const item of payload.result.records) {
    if (!record(item) || String(item.codbairro) !== neighborhoodCode) throw new Error('Relação de bairro incompatível.');
    const id = code(item.codlogradouro);
    const candidates = [item.nome_oficial_logradouro, item.nome_logradouro_concatenado, item.nome_logradouro_resumido].filter((value): value is string => typeof value === 'string');
    if (id && candidates.some((value) => normalizeMunicipalityName(value) === normalizeMunicipalityName(name))) codes.add(id);
  }
  return codes.size === 1 ? [...codes][0] : null;
}

export function parseRecifeStreets(payload: unknown): RecifeStreet[] {
  return features(payload, 25000).flatMap((item): RecifeStreet[] => {
    if (!record(item) || !record(item.properties) || !record(item.geometry)) return [];
    const id = code(item.properties.CLOGRACODI);
    const name = item.properties.NLGPAVOFIC || item.properties.NLOGRACONC;
    if (!id || typeof name !== 'string' || !name.trim() || name.length > 200 || !['LineString', 'MultiLineString'].includes(String(item.geometry.type))) return [];
    const geometry = item.geometry as unknown as LineString | MultiLineString;
    return isSupportedGeometry(geometry) ? [{ code: id, name: name.trim(), geometry, version: '2026-03-02' }] : [];
  });
}

export function matchRecifeStreet(items: readonly RecifeStreet[], streetCode: string): RecifeStreet | null {
  const matches = items.filter((item) => item.code === streetCode);
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const coordinates = matches.flatMap((item) => item.geometry.type === 'LineString' ? [item.geometry.coordinates] : item.geometry.coordinates);
  const geometry: MultiLineString = { type: 'MultiLineString', coordinates };
  return isSupportedGeometry(geometry) ? { ...matches[0], geometry } : null;
}
