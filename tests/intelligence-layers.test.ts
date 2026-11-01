import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MultiPolygon, Polygon } from 'geojson';
import { pointInTerritory, territoryBounds, isAllowedBounds } from '../src/shared/intelligence-layers/spatial';
import { buildOverpassQuery, OverpassIntelligenceProvider, parseOverpass } from '../src/main/services/intelligence-overpass.service';
import type { IntelligenceQuery } from '../src/shared/intelligence-layers/intelligence-types';
import { selectedIntelligenceArea } from '../src/renderer/components/workspace/intelligence-layers/intelligence-area';
import type { SelectedGeographicFeature } from '../src/renderer/components/workspace/location-selection';

const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]];
const polygon: Polygon = { type: 'Polygon', coordinates: [ring, hole] };
const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [[ring, hole], [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]]] };
const request: IntelligenceQuery = { requestId: 'a', bbox: [-8.2, -35.1, -7.9, -34.8], categories: ['health'] };
const payload = { osm3s: { timestamp_osm_base: '2026-01-01T00:00:00Z' }, elements: [
  { type: 'node', id: 1, lat: -8.1, lon: -34.9, tags: { amenity: 'hospital', name: 'Hospital', email: 'ignored' } },
  { type: 'way', id: 2, center: { lat: -8.11, lon: -34.91 }, tags: { amenity: 'clinic' } },
  { type: 'node', id: 3, lat: -8.1, lon: -34.9, tags: { amenity: 'hospital', access: 'private' } },
] };

test('polígonos e multipolígonos respeitam buracos e bordas', () => {
  assert.equal(pointInTerritory([1, 1], polygon), true);
  assert.equal(pointInTerritory([3, 3], polygon), false);
  assert.equal(pointInTerritory([2, 3], polygon), false);
  assert.equal(pointInTerritory([0, 1], polygon), true);
  assert.equal(pointInTerritory([20.5, 20.5], multi), true);
  assert.equal(pointInTerritory([12, 12], multi), false);
  assert.deepEqual(territoryBounds(polygon), [0, 0, 10, 10]);
  assert.equal(isAllowedBounds([0, 0, 10, 10]), false);
  assert.equal(isAllowedBounds(request.bbox), true);
});
test('região selecionada sem geometria não recorre silenciosamente ao limite pai', () => {
  const region = { id: 'uf', name: 'Estado', geometry: polygon, geometryMetadata: { source: 'IBGE', license: 'teste', version: null } } as unknown as SelectedGeographicFeature;
  const city: SelectedGeographicFeature = { ...region, id: 'city', name: 'Cidade', geometry: null };
  assert.equal(selectedIntelligenceArea({ region, city }), null);
  assert.equal(selectedIntelligenceArea({ region })?.name, 'Estado');
  assert.equal(selectedIntelligenceArea({ region, city: { ...city, geometry: multi } })?.name, 'Cidade');
});
test('consulta e normalização preservam fonte sem expor tags não permitidas', () => {
  const query = buildOverpassQuery(request);
  assert.match(query, /nwr\["amenity"="hospital"\]\(-8.2,-35.1,-7.9,-34.8\)/);
  const result = parseOverpass(payload, ['health'], Date.parse('2026-01-01'));
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].representation, 'node');
  assert.equal(result.points[1].representation, 'bbox-center');
  assert.equal(result.points[0].tags.email, undefined);
  assert.equal(result.points[1].name, null);
  assert.throws(() => parseOverpass({ elements: Array(2001).fill({}) }, ['health'], Date.now()));
  assert.throws(() => parseOverpass({ elements: [], remark: 'runtime error' }, ['health'], Date.now()));
});
test('cache, restrição espacial e espera após HTTP 429', async () => {
  let now = 100000, calls = 0, status = 200;
  const service = new OverpassIntelligenceProvider({ now: () => now, fetch: async () => { calls++; return new Response(JSON.stringify(payload), { status }); } });
  const first = await service.query(request); assert.equal(first.cached, false);
  assert.equal((await service.query({ ...request, requestId: 'b' })).cached, true);
  assert.equal(calls, 1);
  await assert.rejects(service.query({ ...request, bbox: [0, 0, 10, 10] }));
  now += 4000; status = 429;
  await assert.rejects(service.query({ ...request, categories: ['education'] }), /30 segundos/);
  now += 5000;
  await assert.rejects(service.query({ ...request, categories: ['transport'] }), /Aguarde/);
});
test('consulta em voo é serializada e pode ser cancelada', async () => {
  const service = new OverpassIntelligenceProvider({ now: () => 100000, fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('cancelada'))); }) });
  const pending = service.query(request);
  await assert.rejects(service.query({ ...request, requestId: 'b', categories: ['education'] }), /andamento/);
  assert.equal(service.cancel('a'), true);
  await assert.rejects(pending, /cancelada/);
});
test('erros de conexão são diferenciados sem apresentar detalhes internos', async () => {
  for (const [detail, expected] of [
    ['net::ERR_INTERNET_DISCONNECTED', /Sem conexão/],
    ['net::ERR_NAME_NOT_RESOLVED', /DNS/],
    ['net::ERR_CERT_AUTHORITY_INVALID', /TLS/],
    ['net::ERR_CONNECTION_RESET', /Não foi possível conectar/],
  ] as const) {
    const service = new OverpassIntelligenceProvider({ now: () => 100000, fetch: async () => { throw new Error(detail); } });
    await assert.rejects(service.query(request), expected);
  }
});
test('timeout é distinguido de cancelamento explícito', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const service = new OverpassIntelligenceProvider({ now: () => 100000, fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }) });
  const pending = service.query(request);
  context.mock.timers.tick(25_000);
  await assert.rejects(pending, /Tempo esgotado/);
});
test('indisponibilidade progressiva impõe espera e sucesso restaura intervalo inicial', async () => {
  let now = 100000, status = 502;
  const service = new OverpassIntelligenceProvider({ now: () => now, fetch: async () => new Response(status === 200 ? JSON.stringify(payload) : '', { status }) });
  await assert.rejects(service.query(request), /HTTP 502/);
  now += 30000;
  await assert.rejects(service.query(request), /HTTP 502/);
  now += 30000;
  await assert.rejects(service.query(request), /Aguarde 30 s/);
  now += 30000; status = 200;
  await service.query(request);
  now += 3000; status = 502;
  await assert.rejects(service.query({ ...request, categories: ['education'] }), /HTTP 502/);
  now += 30000;
  await assert.rejects(service.query({ ...request, categories: ['education'] }), /HTTP 502/);
});
test('respeita Retry-After e rejeita redirecionamentos e respostas grandes', async () => {
  let now = 100000, mode = 'rate';
  const service = new OverpassIntelligenceProvider({ now: () => now, fetch: async () => {
    if (mode === 'rate') return new Response('', { status: 429, headers: { 'retry-after': '120' } });
    if (mode === 'large') return new Response('', { status: 200, headers: { 'content-length': '3000001' } });
    const response = new Response(JSON.stringify(payload));
    Object.defineProperty(response, 'url', { value: 'https://unexpected.example/interpreter' });
    return response;
  } });
  await assert.rejects(service.query(request), /30 segundos/);
  now += 31000;
  await assert.rejects(service.query({ ...request, requestId: 'b' }), /Aguarde/);
  now += 90000; mode = 'large';
  await assert.rejects(service.query({ ...request, requestId: 'c' }), /limite/);
  now += 4000; mode = 'redirect';
  await assert.rejects(service.query({ ...request, requestId: 'd' }), /não autorizado/);
});
