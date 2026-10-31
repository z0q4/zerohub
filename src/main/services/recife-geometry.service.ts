import { app, net } from 'electron';
import { join } from 'node:path';
import type { RecifeNeighborhood, RecifeStreet } from '../../shared/recife-geometry/recife-geometry.types';
import { findRecifeStreetCode, matchRecifeNeighborhood, matchRecifeStreet, parseRecifeNeighborhoods, parseRecifeStreets } from '../../shared/recife-geometry/recife-geometry.validation';
import { RecifeStreetCache } from './recife-street-cache';

const ORIGIN = 'https://dados.recife.pe.gov.br';
const NEIGHBORHOODS = '/dataset/ce23d3f4-7474-44d3-b310-19f3afcebf4a/resource/d5f956ce-7e1f-4c74-839b-06cb490c3721/download/limites-dos-bairros-2023.geojson';
const STREETS = '/dataset/1702c764-ec7a-4ef0-9861-8acd0e40c819/resource/6be90377-7b6d-483c-9b58-f7f34401ee6a/download/trechos-de-logradouros.geojson';
const ASSOCIATIONS = '/api/3/action/datastore_search';
const TTL = 24 * 60 * 60 * 1000;
type Cache<T> = { value: T; expires: number };
type Transport = { fetch: typeof net.fetch; now(): number; resource?: (path: string, signal: AbortSignal, maxBytes: number) => Promise<unknown>; streetCache?: () => RecifeStreetCache };

/** O portal CKAN redireciona estes dois arquivos para seu armazenamento assinado. */
export function isRecifeResourceRedirect(path: string, destination: string): boolean {
  const expected = path === NEIGHBORHOODS
    ? '/ckan-base/resources/d5f956ce-7e1f-4c74-839b-06cb490c3721/limites-dos-bairros-2023.geojson'
    : path === STREETS
      ? '/ckan-base/resources/6be90377-7b6d-483c-9b58-f7f34401ee6a/trechos-de-logradouros.geojson'
      : null;
  try {
    const url = new URL(destination);
    return expected !== null && url.origin === 'https://ckan-storage-download.app.emprel.gov.br' && !url.username && !url.password && url.pathname === expected;
  } catch { return false; }
}

function fetchOfficialResource(path: string, signal: AbortSignal, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Consulta cancelada.')); return; }
    const request = net.request({ method: 'GET', url: `${ORIGIN}${path}`, redirect: 'manual', credentials: 'omit', headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'ZeroHub/0.1.0 Recife geographic data' } });
    let finished = false;
    let redirects = 0;
    const abort = () => finish(new Error('Consulta cancelada.'));
    const timer = setTimeout(() => finish(new Error('Tempo esgotado ao consultar a Prefeitura do Recife.')), 30_000);
    const finish = (error?: Error, value?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) { request.abort(); reject(error); } else resolve(value);
    };
    signal.addEventListener('abort', abort, { once: true });
    request.on('redirect', (_status, method, destination) => {
      if (++redirects !== 1 || method !== 'GET' || !isRecifeResourceRedirect(path, destination)) { finish(new Error('Redirecionamento geográfico inválido.')); return; }
      request.followRedirect();
    });
    request.on('error', () => finish(new Error('Falha ao consultar dados geográficos da Prefeitura do Recife.')));
    request.on('response', (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) { finish(new Error(`Prefeitura do Recife respondeu HTTP ${response.statusCode}.`)); return; }
      const length = Number(response.headers['content-length'] || 0);
      if (length > maxBytes) { finish(new Error('Resposta geográfica excede o limite.')); return; }
      const chunks: Buffer[] = []; let total = 0;
      response.on('data', (chunk: Buffer) => { total += chunk.length; if (total > maxBytes) { finish(new Error('Resposta geográfica excede o limite.')); return; } chunks.push(chunk); });
      response.on('error', () => finish(new Error('Falha ao receber dados geográficos da Prefeitura do Recife.')));
      response.on('end', () => {
        if (finished) return;
        try { finish(undefined, JSON.parse(Buffer.concat(chunks, total).toString('utf8')) as unknown); }
        catch { finish(new Error('Dados geográficos da Prefeitura do Recife inválidos.')); }
      });
    });
    request.end();
  });
}

export class RecifeGeometryService {
  private neighborhoods: Cache<RecifeNeighborhood[]> | null = null;
  private streets: Cache<RecifeStreet[]> | null = null;
  private readonly relations = new Map<string, Cache<unknown>>();
  private readonly controllers = new Map<string, AbortController>();
  private loadingNeighborhoods: Promise<RecifeNeighborhood[]> | null = null;
  private loadingStreets: Promise<RecifeStreet[]> | null = null;
  constructor(private readonly transport: Transport = { fetch: (...args) => net.fetch(...args), resource: fetchOfficialResource, now: () => Date.now(), streetCache: () => new RecifeStreetCache(join(app.getPath('userData'), 'cache')) }) {}

  cancel(id: string): boolean { const controller = this.controllers.get(id); if (!controller) return false; controller.abort(); return true; }
  private async run<T>(id: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.cancel(id);
    const controller = new AbortController();
    this.controllers.set(id, controller);
    try { return await operation(controller.signal); }
    finally { if (this.controllers.get(id) === controller) this.controllers.delete(id); }
  }
  private async get(path: string, signal: AbortSignal, maxBytes: number): Promise<unknown> {
    if (signal.aborted) throw new Error('Consulta cancelada.');
    if ((path === NEIGHBORHOODS || path === STREETS) && this.transport.resource) return this.transport.resource(path, signal, maxBytes);
    const timeout = AbortSignal.timeout(30_000);
    const response = await this.transport.fetch(`${ORIGIN}${path}`, { signal: AbortSignal.any([signal, timeout]), redirect: 'error', headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'ZeroHub/0.1.0 Recife geographic data' } });
    if (!response.ok) throw new Error(`Prefeitura do Recife respondeu HTTP ${response.status}.`);
    if (response.url && new URL(response.url).origin !== ORIGIN) throw new Error('Origem dos dados inválida.');
    if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('Resposta geográfica excede o limite.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Resposta geográfica vazia.');
    const chunks: Uint8Array[] = []; let total = 0;
    let part = await reader.read();
    while (!part.done) { total += part.value.byteLength; if (total > maxBytes) { await reader.cancel(); throw new Error('Resposta geográfica excede o limite.'); } chunks.push(part.value); part = await reader.read(); }
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (signal.aborted) throw new Error('Consulta cancelada.');
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
  private async loadNeighborhoods(signal: AbortSignal): Promise<RecifeNeighborhood[]> {
    if (this.neighborhoods && this.neighborhoods.expires > this.transport.now()) return this.neighborhoods.value;
    if (this.loadingNeighborhoods) {
      try { await this.loadingNeighborhoods; } catch { /* Uma consulta cancelada pode ser substituída. */ }
      if (signal.aborted) throw new Error('Consulta cancelada.');
      return this.loadNeighborhoods(signal);
    }
    const loading = (async () => {
      const data = parseRecifeNeighborhoods(await this.get(NEIGHBORHOODS, signal, 4_000_000));
      if (!data.length) throw new Error('Nenhum bairro válido retornado.');
      this.neighborhoods = { value: data, expires: this.transport.now() + TTL };
      return data;
    })();
    this.loadingNeighborhoods = loading;
    try {
      return await loading;
    } finally { if (this.loadingNeighborhoods === loading) this.loadingNeighborhoods = null; }
  }
  async neighborhood(cityCode: string, name: string, requestId: string, savedCode?: string): Promise<RecifeNeighborhood | null> {
    if (cityCode !== '2611606' || !name.trim() || name.length > 160 || (savedCode !== undefined && !/^\d{1,8}$/.test(savedCode))) throw new Error('Solicitação de bairro inválida.');
    return this.run(requestId, async (signal) => matchRecifeNeighborhood(await this.loadNeighborhoods(signal), name, savedCode));
  }
  private async loadStreets(signal: AbortSignal): Promise<RecifeStreet[]> {
    if (this.streets && this.streets.expires > this.transport.now()) return this.streets.value;
    if (this.loadingStreets) {
      try { await this.loadingStreets; } catch { /* Uma consulta cancelada pode ser substituída. */ }
      if (signal.aborted) throw new Error('Consulta cancelada.');
      return this.loadStreets(signal);
    }
    const loading = (async () => {
      const cache = this.transport.streetCache?.();
      const saved = await cache?.read();
      if (signal.aborted) throw new Error('Consulta cancelada.');
      if (saved) { this.rememberStreets(saved.items, saved.expires); return saved.items; }
      const data = parseRecifeStreets(await this.get(STREETS, signal, 18_000_000));
      if (!data.length) throw new Error('Nenhuma via válida retornada.');
      if (signal.aborted) throw new Error('Consulta cancelada.');
      this.rememberStreets(data, this.transport.now() + TTL);
      await cache?.write(data).catch((): void => { /* Cache is optional. */ });
      if (signal.aborted) throw new Error('Consulta cancelada.');
      return data;
    })();
    this.loadingStreets = loading;
    try { return await loading; }
    finally { if (this.loadingStreets === loading) this.loadingStreets = null; }
  }
  private rememberStreets(value: RecifeStreet[], expires: number): void {
    const entry = { value, expires };
    this.streets = entry;
    const timer = setTimeout(() => { if (this.streets === entry) this.streets = null; }, Math.max(1, expires - this.transport.now()));
    timer.unref();
  }
  async street(cityCode: string, neighborhoodCode: string, name: string, requestId: string, savedCode?: string): Promise<RecifeStreet | null> {
    if (cityCode !== '2611606' || !/^\d{1,8}$/.test(neighborhoodCode) || !name.trim() || name.length > 200 || (savedCode !== undefined && !/^\d{1,8}$/.test(savedCode))) throw new Error('Solicitação de via inválida.');
    return this.run(requestId, async (signal) => {
      const neighborhoods = await this.loadNeighborhoods(signal);
      if (!neighborhoods.some((item) => item.code === neighborhoodCode)) throw new Error('Bairro não consta na fonte oficial.');
      const cached = this.relations.get(neighborhoodCode);
      let relation = cached && cached.expires > this.transport.now() ? cached.value : null;
      if (!relation) {
        const query = new URLSearchParams({ resource_id: '15f820ba-6370-4d49-af5e-4eec6e559bf6', filters: JSON.stringify({ codbairro: Number(neighborhoodCode) }), limit: '1000' });
        relation = await this.get(`${ASSOCIATIONS}?${query}`, signal, 2_000_000);
      }
      const streetCode = findRecifeStreetCode(relation, neighborhoodCode, name);
      if (!cached || cached.expires <= this.transport.now()) {
        this.relations.set(neighborhoodCode, { value: relation, expires: this.transport.now() + TTL });
        while (this.relations.size > 20) { const oldest = this.relations.keys().next().value; if (!oldest) break; this.relations.delete(oldest); }
      }
      if (!streetCode || savedCode && savedCode !== streetCode) return null;
      if (signal.aborted) throw new Error('Consulta cancelada.');
      const streets = await this.loadStreets(signal);
      if (signal.aborted) throw new Error('Consulta cancelada.');
      return matchRecifeStreet(streets, streetCode);
    });
  }
}
export const recifeGeometryService = new RecifeGeometryService();
