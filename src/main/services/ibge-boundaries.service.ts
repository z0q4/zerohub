import { net } from 'electron';
import type { IbgeBoundary, IbgeMunicipality } from '../../shared/municipal-boundaries/municipal-boundaries.types';
import { isIbgeMunicipalityCode, isIbgeStateCode } from '../../shared/municipal-boundaries/municipal-boundaries.types';
import { isSupportedGeometry } from '../../shared/municipal-boundaries/geometry-validation';
import type { Polygon, MultiPolygon } from 'geojson';

const ORIGIN = 'https://servicodados.ibge.gov.br';
const TTL = 24 * 60 * 60 * 1000;
const MAX_BYTES = 2_000_000;
type CacheValue<T> = { value: T; expires: number };
type Transport = { fetch: typeof net.fetch; now(): number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export class IbgeBoundaryService {
  private readonly cities = new Map<string, CacheValue<IbgeMunicipality[]>>();
  private readonly boundaries = new Map<string, CacheValue<IbgeBoundary>>();
  private readonly controllers = new Map<string, AbortController>();
  constructor(private readonly transport: Transport = { fetch: (...args) => net.fetch(...args), now: () => Date.now() }) {}
  cancel(id: string): boolean { const c = this.controllers.get(id); if (!c) return false; c.abort(); return true; }
  private async get(path: string, requestId: string): Promise<unknown> {
    const controller = new AbortController();
    this.cancel(requestId);
    this.controllers.set(requestId, controller);
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.transport.fetch(`${ORIGIN}${path}`, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json, application/vnd.geo+json', 'User-Agent': 'ZeroHub/0.1.0 geographic boundaries' } });
      if (!response.ok) throw new Error(`IBGE respondeu HTTP ${response.status}.`);
      if (response.url && new URL(response.url).origin !== ORIGIN) throw new Error('Origem IBGE inválida.');
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) throw new Error('Resposta IBGE excede o limite.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Resposta IBGE vazia.');
      const chunks: Uint8Array[] = []; let total = 0;
      let part = await reader.read();
      while (!part.done) { total += part.value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Resposta IBGE excede o limite.'); } chunks.push(part.value); part = await reader.read(); }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } finally { clearTimeout(timer); if (this.controllers.get(requestId) === controller) this.controllers.delete(requestId); }
  }
  async list(stateCode: string, requestId: string): Promise<IbgeMunicipality[]> {
    if (!isIbgeStateCode(stateCode)) throw new Error('UF IBGE inválida.');
    const cached = this.cities.get(stateCode); if (cached && cached.expires > this.transport.now()) return cached.value;
    const payload = await this.get(`/api/v1/localidades/estados/${stateCode}/municipios`, requestId);
    if (!Array.isArray(payload) || payload.length > 1000) throw new Error('Catálogo IBGE inválido.');
    const items: IbgeMunicipality[] = [];
    for (const item of payload) {
      if (!record(item) || !isIbgeMunicipalityCode(String(item.id), stateCode) || typeof item.nome !== 'string' || !item.nome.trim() || item.nome.length > 160) throw new Error('Município IBGE inválido.');
      items.push({ code: String(item.id), name: item.nome, stateCode });
    }
    this.cities.set(stateCode, { value: items, expires: this.transport.now() + TTL });
    return items;
  }
  async boundary(stateCode: string, code: string, requestId: string): Promise<IbgeBoundary> {
    if (!isIbgeStateCode(stateCode) || !isIbgeMunicipalityCode(code, stateCode)) throw new Error('Código municipal incompatível com a UF.');
    const cached = this.boundaries.get(code); if (cached && cached.expires > this.transport.now()) return cached.value;
    const catalog = await this.list(stateCode, requestId);
    if (!catalog.some((item) => item.code === code)) throw new Error('Município não consta no catálogo da UF.');
    const payload = await this.get(`/api/v3/malhas/municipios/${code}?formato=application%2Fvnd.geo%2Bjson&qualidade=intermediaria`, requestId);
    if (!record(payload) || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) || payload.features.length !== 1) throw new Error('Malha IBGE inválida.');
    const feature = payload.features[0];
    if (!record(feature) || !record(feature.properties) || String(feature.properties.codarea) !== code || !record(feature.geometry) || !['Polygon', 'MultiPolygon'].includes(String(feature.geometry.type))) throw new Error('Malha IBGE não corresponde ao município.');
    const geometry = feature.geometry as unknown as Polygon | MultiPolygon;
    if (!isSupportedGeometry(geometry)) throw new Error('Geometria municipal IBGE inválida.');
    const boundary: IbgeBoundary = { code, stateCode, geometry, source: 'IBGE', version: null };
    this.boundaries.set(code, { value: boundary, expires: this.transport.now() + TTL });
    while (this.boundaries.size > 50) { const oldest = this.boundaries.keys().next().value; if (!oldest) break; this.boundaries.delete(oldest); }
    return boundary;
  }
}
export const ibgeBoundaryService = new IbgeBoundaryService();
