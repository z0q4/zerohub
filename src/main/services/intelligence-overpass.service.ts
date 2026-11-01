import { net } from 'electron';
import { INTELLIGENCE_CATEGORIES, isIntelligenceCategory } from '../../shared/intelligence-layers/intelligence-types';
import type { IntelligenceCategory, IntelligencePoint, IntelligenceProvider, IntelligenceQuery, IntelligenceResponse } from '../../shared/intelligence-layers/intelligence-types';
import { isAllowedBounds } from '../../shared/intelligence-layers/spatial';

const ENDPOINT = 'https://overpass.private.coffee/api/interpreter';
const MAX_BYTES = 3_000_000, MAX_RESULTS = 2000, TTL = 30 * 60_000, MIN_INTERVAL = 3000;
const allowedTags = ['name', 'amenity', 'healthcare', 'aeroway', 'railway', 'public_transport', 'office', 'operator', 'addr:street', 'addr:housenumber', 'addr:city', 'addr:postcode'] as const;
type Transport = { fetch: typeof net.fetch; now(): number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function connectionMessage(error: unknown): string | null {
  const cause = error instanceof Error ? error.cause : null;
  const details = `${error instanceof Error ? error.message : ''} ${cause instanceof Error ? cause.message : ''}`;
  if (/ERR_INTERNET_DISCONNECTED|ENETDOWN/i.test(details)) return 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/i.test(details)) return 'Não foi possível resolver o endereço do servidor Overpass (DNS).';
  if (/ERR_CERT_|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(details)) return 'Não foi possível estabelecer uma conexão TLS segura com o servidor Overpass.';
  if (/ERR_CONNECTION|ERR_ADDRESS_UNREACHABLE|ERR_NETWORK|ERR_FAILED|ECONN|EHOSTUNREACH|ENETUNREACH|failed to fetch|fetch failed|network/i.test(details)) return 'Não foi possível conectar ao servidor Overpass. Verifique a conexão ou tente novamente mais tarde.';
  return null;
}

export function buildOverpassQuery(request: IntelligenceQuery): string {
  const bbox = request.bbox.join(',');
  const selectors = INTELLIGENCE_CATEGORIES.filter((category) => request.categories.includes(category.id)).flatMap((category) => category.tags.map(([key, value]) => `nwr["${key}"="${value}"](${bbox});`));
  return `[out:json][timeout:20][maxsize:67108864];(${selectors.join('')});out center ${MAX_RESULTS + 1};`;
}
export function parseOverpass(payload: unknown, categories: IntelligenceCategory[], now: number): IntelligenceResponse {
  if (!record(payload) || !Array.isArray(payload.elements) || typeof payload.remark === 'string' && payload.remark.trim()) throw new Error('Resposta Overpass inválida ou incompleta.');
  if (payload.elements.length > MAX_RESULTS) throw new Error('A região retornou muitos objetos. Consulte uma área ou menos categorias.');
  const points: IntelligencePoint[] = [], seen = new Set<string>();
  for (const element of payload.elements) {
    if (!record(element) || !['node', 'way', 'relation'].includes(String(element.type)) || !Number.isSafeInteger(element.id) || (element.id as number) <= 0 || !record(element.tags)) continue;
    if (['private', 'no'].includes(String(element.tags.access))) continue;
    const category = INTELLIGENCE_CATEGORIES.find((item) => categories.includes(item.id) && item.tags.some(([key, value]) => element.tags && record(element.tags) && element.tags[key] === value));
    if (!category) continue;
    const center = element.type === 'node' ? element : element.center;
    if (!record(center) || typeof center.lat !== 'number' || typeof center.lon !== 'number' || !Number.isFinite(center.lat) || !Number.isFinite(center.lon) || Math.abs(center.lat) > 90 || Math.abs(center.lon) > 180) continue;
    const id = `${element.type}/${element.id}`;
    if (seen.has(id)) continue; seen.add(id);
    const tags: Record<string, string> = {};
    for (const key of allowedTags) { const value = element.tags[key]; if (typeof value === 'string' && value.trim()) tags[key] = value.trim().slice(0, 200); }
    points.push({ id, category: category.id, latitude: center.lat, longitude: center.lon, name: tags.name ?? null, tags, representation: element.type === 'node' ? 'node' : 'bbox-center', source: 'OpenStreetMap', license: 'ODbL-1.0' });
  }
  const base = record(payload.osm3s) && typeof payload.osm3s.timestamp_osm_base === 'string' && Number.isFinite(Date.parse(payload.osm3s.timestamp_osm_base)) ? payload.osm3s.timestamp_osm_base : null;
  return { points, fetchedAt: new Date(now).toISOString(), dataTimestamp: base, cached: false };
}
export class OverpassIntelligenceProvider implements IntelligenceProvider {
  private readonly cache = new Map<string, { expires: number; value: IntelligenceResponse }>();
  private active: { id: string; controller: AbortController } | null = null;
  private nextRequest = 0;
  private requests: number[] = [];
  private consecutiveFailures = 0;
  constructor(private readonly transport: Transport = { fetch: (...args) => net.fetch(...args), now: () => Date.now() }) {}
  cancel(id: string): boolean { if (this.active?.id !== id) return false; this.active.controller.abort(); return true; }
  private backoff(): void {
    this.consecutiveFailures = Math.min(this.consecutiveFailures + 1, 5);
    const delay = Math.min(30_000 * 2 ** (this.consecutiveFailures - 1), 300_000);
    this.nextRequest = Math.max(this.nextRequest, this.transport.now() + delay);
  }
  async query(request: IntelligenceQuery): Promise<IntelligenceResponse> {
    if (!request || typeof request.requestId !== 'string' || !request.requestId.trim() || request.requestId.length > 128 || !isAllowedBounds(request.bbox) || !Array.isArray(request.categories) || !request.categories.length || request.categories.length > INTELLIGENCE_CATEGORIES.length || !request.categories.every(isIntelligenceCategory) || new Set(request.categories).size !== request.categories.length) throw new Error('Consulta inválida ou área muito grande; selecione uma região menor.');
    const now = this.transport.now();
    const key = JSON.stringify([request.bbox, [...request.categories].sort()]);
    const cached = this.cache.get(key); if (cached && cached.expires > now) return { ...cached.value, cached: true };
    this.requests = this.requests.filter((time) => time > now - 86_400_000);
    if (this.active) throw new Error('Já existe uma consulta em andamento; aguarde ou cancele.');
    if (now < this.nextRequest) throw new Error(`Aguarde ${Math.ceil((this.nextRequest - now) / 1000)} s antes de outra consulta.`);
    if (this.requests.length >= 30) throw new Error('Limite local diário atingido. Para uso frequente, utilize extratos ou infraestrutura própria.');
    const controller = new AbortController(); this.active = { id: request.requestId, controller }; this.nextRequest = now + MIN_INTERVAL; this.requests.push(now);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25_000);
    try {
      const response = await this.transport.fetch(ENDPOINT, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json', 'User-Agent': 'ZeroHub/0.1.0 (https://github.com/z0q4/zerohub)' }, body: new URLSearchParams({ data: buildOverpassQuery(request) }).toString() });
      if (response.status === 429 || response.status === 406) {
        const retry = response.headers.get('retry-after');
        const seconds = retry === null ? NaN : Number(retry);
        const requestedDelay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : retry ? Date.parse(retry) - this.transport.now() : 0;
        this.nextRequest = this.transport.now() + Math.max(30_000, Number.isFinite(requestedDelay) ? requestedDelay : 0);
        throw new Error('Servidor sobrecarregado (429/406); aguarde pelo menos 30 segundos.');
      }
      if (!response.ok) { if (response.status >= 500) this.backoff(); throw new Error(`Overpass indisponível (HTTP ${response.status}).`); }
      if (response.url && response.url !== ENDPOINT) throw new Error('Origem ou redirecionamento Overpass não autorizado.');
      if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('Resposta Overpass excede o limite de segurança.');
      const reader = response.body?.getReader(); if (!reader) throw new Error('Resposta Overpass vazia.');
      const chunks: Uint8Array[] = []; let bytes = 0;
      let part = await reader.read();
      while (!part.done) { bytes += part.value.byteLength; if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Resposta Overpass excede o limite de segurança.'); } chunks.push(part.value); part = await reader.read(); }
      const buffer = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      const value = parseOverpass(JSON.parse(new TextDecoder().decode(buffer)) as unknown, request.categories, this.transport.now());
      this.consecutiveFailures = 0;
      this.cache.set(key, { value, expires: this.transport.now() + TTL });
      while (this.cache.size > 20) { const oldest = this.cache.keys().next().value; if (oldest === undefined) break; this.cache.delete(oldest); }
      return value;
    } catch (error: unknown) {
      if (timedOut) { this.backoff(); throw new Error('Tempo esgotado ao consultar o servidor Overpass. Tente novamente mais tarde.'); }
      if (controller.signal.aborted) throw new Error('Consulta cancelada.');
      const message = connectionMessage(error);
      if (message) { this.backoff(); throw new Error(message); }
      throw error;
    } finally { clearTimeout(timer); if (this.active?.controller === controller) this.active = null; }
  }
}
export const intelligenceProvider = new OverpassIntelligenceProvider();
