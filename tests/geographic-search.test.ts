import assert from 'node:assert/strict';
import {
  test,
} from 'node:test';

import {
  parseGeographicRequestId,
  parseGeographicReverseRequest,
  parseGeographicSearchRequest,
} from '../src/main/ipc/geographic-search.ipc';
import {
  GeographicSearchService,
} from '../src/main/services/geographic-search.service';
import {
  createCoordinateResult,
} from '../src/renderer/components/workspace/useUniversalSearch';
import {
  bearingDegrees,
  distanceMeters,
  polygonAreaSquareMeters,
} from '../src/renderer/components/workspace/geo-measurement';
import {
  MAX_GEOJSON_FEATURES,
  previewGeoJson,
} from '../src/renderer/components/workspace/geojson-import';
import {
  classifyUniversalSearch,
  parseUniversalCoordinates,
} from '../src/shared/geographic-search/geographic-search.validation';
import { isSupportedGeometry, matchesLocationParents, selectLocationLevel, selectionFeatures } from '../src/renderer/components/workspace/location-selection';
import type { GeographicSearchResult } from '../src/shared/geographic-search/geographic-search.types';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { geometryBounds, resolveLocalBoundary, searchLocalBoundaries } from '../src/renderer/components/workspace/location-boundaries';
import { IbgeBoundaryService } from '../src/main/services/ibge-boundaries.service';
import { ibgeStateCode, matchIbgeMunicipality } from '../src/shared/municipal-boundaries/municipal-boundaries.types';
import { restoredLocationCamera, restoreSavedLocation } from '../src/renderer/components/workspace/location-restoration';
import { isRecifeResourceRedirect, RecifeGeometryService } from '../src/main/services/recife-geometry.service';
import { findRecifeStreetCode } from '../src/shared/recife-geometry/recife-geometry.validation';
import { RecifeStreetCache } from '../src/main/services/recife-street-cache';

test('cache persistente de vias limita validade e descarta dados corrompidos', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zerohub-recife-cache-test-'));
  try {
    let now = 1000;
    const cache = new RecifeStreetCache(directory, () => now);
    const items = [{ code: '11720', name: 'Avenida Boa Viagem', version: '2026-03-02' as const, geometry: { type: 'LineString' as const, coordinates: [[-35, -8], [-34, -8]] } }];
    assert.equal(await cache.read(), null);
    await cache.write(items);
    assert.deepEqual((await new RecifeStreetCache(directory, () => now).read())?.items, items);
    now += 24 * 60 * 60 * 1000;
    assert.equal(await cache.read(), null);
    await writeFile(join(directory, 'recife-streets-v1.json.gz'), 'invalid');
    assert.equal(await cache.read(), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('redirecionamento de arquivos municipais aceita apenas destino oficial específico', () => {
  const path = '/dataset/ce23d3f4-7474-44d3-b310-19f3afcebf4a/resource/d5f956ce-7e1f-4c74-839b-06cb490c3721/download/limites-dos-bairros-2023.geojson';
  const official = 'https://ckan-storage-download.app.emprel.gov.br/ckan-base/resources/d5f956ce-7e1f-4c74-839b-06cb490c3721/limites-dos-bairros-2023.geojson';
  assert.equal(isRecifeResourceRedirect(path, `${official}?signature=example`), true);
  assert.equal(isRecifeResourceRedirect(path, official.replace('https:', 'http:')), false);
  assert.equal(isRecifeResourceRedirect(path, official.replace('emprel.gov.br/', 'emprel.gov.br.example/')), false);
  assert.equal(isRecifeResourceRedirect(path, official.replace('limites-dos-bairros-2023', 'other')), false);
  assert.equal(isRecifeResourceRedirect('/other', official), false);
});

test('Recife associa bairro e via por códigos oficiais e reutiliza cache', async () => {
  let count = 0;
  const fetch: typeof globalThis.fetch = async (input) => {
    count += 1;
    const url = String(input);
    const payload = url.includes('limites-dos-bairros')
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { CBAIRRCODI: 205, EBAIRRNOMEOF: 'Boa Viagem' }, geometry: { type: 'Polygon', coordinates: [[[-35, -8], [-34, -8], [-34, -7], [-35, -8]]] } }] }
      : url.includes('datastore_search')
        ? { success: true, result: { total: 1, records: [{ codbairro: 205, codlogradouro: 11720, nome_oficial_logradouro: 'Avenida Boa Viagem' }] } }
        : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { CLOGRACODI: 11720, NLGPAVOFIC: 'Avenida Boa Viagem' }, geometry: { type: 'MultiLineString', coordinates: [[[-35, -8], [-34, -8]]] } }] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const service = new RecifeGeometryService({ fetch, now: () => 1 });
  assert.equal((await service.neighborhood('2611606', 'boa viagem', 'one'))?.code, '205');
  const street = await service.street('2611606', '205', 'Avenida Boa Viagem', 'two');
  assert.equal(street?.code, '11720');
  assert.equal(street?.geometry.type, 'MultiLineString');
  assert.equal((await service.street('2611606', '205', 'Avenida Boa Viagem', 'three'))?.code, '11720');
  assert.equal(count, 3);
  await assert.rejects(service.neighborhood('2607901', 'Boa Viagem', 'invalid'));
  await assert.rejects(service.street('2611606', '999', 'Avenida Boa Viagem', 'invalid'));
});

test('nova instância reutiliza vias em disco sem baixar o GeoJSON novamente', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zerohub-recife-service-test-'));
  try {
    let streetDownloads = 0;
    const fetch: typeof globalThis.fetch = async (input) => {
      const url = String(input);
      const street = url.includes('trechos-de-logradouros.geojson');
      if (street) streetDownloads += 1;
      const payload = url.includes('limites-dos-bairros')
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { CBAIRRCODI: 205, EBAIRRNOMEOF: 'Boa Viagem' }, geometry: { type: 'Polygon', coordinates: [[[-35, -8], [-34, -8], [-34, -7], [-35, -8]]] } }] }
        : street ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { CLOGRACODI: 11720, NLGPAVOFIC: 'Avenida Boa Viagem' }, geometry: { type: 'LineString', coordinates: [[-35, -8], [-34, -8]] } }] }
          : { success: true, result: { total: 1, records: [{ codbairro: 205, codlogradouro: 11720, nome_oficial_logradouro: 'Avenida Boa Viagem' }] } };
      return new Response(JSON.stringify(payload));
    };
    const transport = { fetch, now: () => 1000, streetCache: () => new RecifeStreetCache(directory, () => 1000) };
    assert.ok(await new RecifeGeometryService(transport).street('2611606', '205', 'Avenida Boa Viagem', 'first'));
    assert.ok(await new RecifeGeometryService(transport).street('2611606', '205', 'Avenida Boa Viagem', 'second'));
    assert.equal(streetDownloads, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Recife rejeita associações incompletas, bairro divergente e ruas ambíguas', () => {
  const row = { codbairro: 205, codlogradouro: 11720, nome_oficial_logradouro: 'Avenida Boa Viagem' };
  assert.equal(findRecifeStreetCode({ success: true, result: { total: 1, records: [row] } }, '205', 'avenida boa viagem'), '11720');
  assert.equal(findRecifeStreetCode({ success: true, result: { total: 2, records: [row, { ...row, codlogradouro: 11111 }] } }, '205', 'Avenida Boa Viagem'), null);
  assert.throws(() => findRecifeStreetCode({ success: true, result: { total: 2, records: [row] } }, '205', 'Avenida Boa Viagem'));
  assert.throws(() => findRecifeStreetCode({ success: true, result: { total: 1, records: [row] } }, '999', 'Avenida Boa Viagem'));
});

test('IBGE vincula município à UF, valida geometria e reutiliza cache', async () => {
  let requests = 0;
  const mockFetch: typeof globalThis.fetch = async (input) => {
    requests += 1;
    const url = String(input);
    const payload = url.includes('/localidades/')
      ? [{ id: 2611606, nome: 'Recife' }, { id: 2607901, nome: 'Jaboatão dos Guararapes' }]
      : url.includes('2607901')
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codarea: '2607901' }, geometry: { type: 'MultiPolygon', coordinates: [[[[-35, -8], [-34, -8], [-34, -7], [-35, -8]]]] } }] }
        : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codarea: '2611606' }, geometry: { type: 'Polygon', coordinates: [[[-35, -8], [-34, -8], [-34, -7], [-35, -8]]] } }] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const provider = new IbgeBoundaryService({ fetch: mockFetch, now: () => 1000 });
  assert.equal(ibgeStateCode('Pernambuco'), '26');
  assert.equal(ibgeStateCode('São Paulo'), '35');
  const repeated = [{ code: '2611606', stateCode: '26', name: 'Exemplo' }, { code: '3512345', stateCode: '35', name: 'Exemplo' }];
  assert.equal(matchIbgeMunicipality(repeated, '26', 'Exemplo')?.code, '2611606');
  assert.equal(matchIbgeMunicipality([...repeated, { code: '2601234', stateCode: '26', name: 'Exemplo' }], '26', 'Exemplo'), null);
  assert.equal(matchIbgeMunicipality(repeated, '26', 'Exemplo', '3512345'), null);
  const cities = await provider.list('26', 'first');
  assert.equal(cities.find((item) => item.name === 'Recife')?.code, '2611606');
  assert.equal(cities.find((item) => item.name === 'Jaboatão dos Guararapes')?.code, '2607901');
  const boundary = await provider.boundary('26', '2611606', 'second');
  assert.equal(boundary.geometry.type, 'Polygon');
  await provider.boundary('26', '2611606', 'third');
  assert.equal(requests, 2);
  assert.equal((await provider.boundary('26', '2607901', 'fourth')).geometry.type, 'MultiPolygon');
  assert.equal(requests, 3);
  await assert.rejects(provider.boundary('35', '2611606', 'bad'));
  await assert.rejects(provider.boundary('26', '2600000', 'bad'));
});

test('IBGE rejeita malha de código diferente e geometria inválida', async () => {
  const mockFetch: typeof globalThis.fetch = async (input) => new Response(JSON.stringify(String(input).includes('/localidades/')
    ? [{ id: 2611606, nome: 'Recife' }]
    : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codarea: '2611606' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } }] }), { status: 200 });
  const provider = new IbgeBoundaryService({ fetch: mockFetch, now: () => 1 });
  await assert.rejects(provider.boundary('26', '2611606', 'invalid'));
});

test('limites locais identificam Brasil e Pernambuco sem fabricar cidade', () => {
  const countries = JSON.parse(readFileSync(new URL('../src/renderer/assets/map/countries.geojson', import.meta.url), 'utf8')) as FeatureCollection;
  const regions = JSON.parse(readFileSync(new URL('../src/renderer/assets/map/admin1.geojson', import.meta.url), 'utf8')) as FeatureCollection;
  const [brazil] = searchLocalBoundaries('country', 'Brasil', {}, countries, regions);
  assert.ok(brazil);
  const country = resolveLocalBoundary('country', brazil, {}, countries, regions);
  assert.ok(country.geometry?.type === 'Polygon' || country.geometry?.type === 'MultiPolygon');
  const [pernambuco] = searchLocalBoundaries('region', 'Pernambuco', { country }, countries, regions);
  assert.ok(pernambuco);
  const region = resolveLocalBoundary('region', pernambuco, { country }, countries, regions);
  assert.ok(region.geometry?.type === 'Polygon' || region.geometry?.type === 'MultiPolygon');
  const city = resolveLocalBoundary('city', { ...pernambuco, name: 'Recife', type: 'city' }, { country, region }, countries, regions);
  assert.equal(city.geometry, null);
  const features = selectionFeatures({ country, region, city });
  assert.equal(features.features.length, 2);
  const exact = { ...city, id: 'address', name: 'Endereço', type: 'address' as const, latitude: -8.1, longitude: -34.9 };
  const withPoint = selectionFeatures({ country, region, city, exact });
  const point = withPoint.features[2].geometry;
  if (point.type !== 'Point') assert.fail('O local exato deve ser um ponto.');
  assert.deepEqual(point.coordinates, [-34.9, -8.1]);
  assert.equal(searchLocalBoundaries('region', 'Pernambuco', {}, countries, regions).length, 0);
  const oldSaved = { levels: [country, region, city].map((item, index) => ({ level: ['country', 'region', 'city'][index], id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude, source: item.provider })) };
  const restored = restoreSavedLocation(oldSaved, countries, regions);
  assert.equal(restored?.country?.geometry?.type, country.geometry?.type);
  assert.equal(restored?.region?.geometry?.type, region.geometry?.type);
  assert.equal(restored?.city?.geometry, null);
  assert.equal(restoreSavedLocation({ levels: [{ ...oldSaved.levels[0], latitude: 100 }] }, countries, regions), null);
  assert.equal(restoreSavedLocation({ oldSchema: true }, countries, regions), null);
  const coordinate = { level: 'exact', id: 'coordinate:-8,-35', name: '-8, -35', latitude: -8, longitude: -35, source: 'local', sourceId: 'user-coordinate', type: 'coordinate' };
  const partial = restoreSavedLocation({ levels: [...oldSaved.levels, coordinate] }, countries, regions);
  assert.equal(partial?.exact?.sourceId, 'user-coordinate');
  assert.equal(partial?.neighbourhood, undefined);
  assert.equal(selectionFeatures(partial ?? {}).features.at(-1)?.geometry.type, 'Point');
  assert.deepEqual(restoredLocationCamera(partial ?? {}), { center: [-35, -8], zoom: 15 });
  assert.deepEqual(restoredLocationCamera(restored ?? {}), { center: [city.longitude, city.latitude], zoom: 10 });
  assert.ok(restoredLocationCamera({ country }) && 'bounds' in (restoredLocationCamera({ country }) ?? {}));
  assert.equal(restoredLocationCamera({}), null);
  const photonCity = { ...oldSaved.levels[2], id: 'photon:R:12345', source: 'photon' };
  const restoredPhoton = restoreSavedLocation({ levels: [...oldSaved.levels.slice(0, 2), photonCity] }, countries, regions);
  assert.equal(restoredPhoton?.city?.sourceId, 'R:12345');
});

test('bounds tratam Polygon, MultiPolygon e antimeridiano', () => {
  assert.deepEqual(geometryBounds({ type: 'Polygon', coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] }), [[1, 2], [3, 4]]);
  assert.deepEqual(geometryBounds({ type: 'MultiPolygon', coordinates: [[[[179, -1], [180, -1], [180, 1], [179, -1]]], [[[-180, -1], [-179, -1], [-179, 1], [-180, -1]]]] }), [[179, -1], [181, 1]]);
  assert.equal(geometryBounds({ type: 'Polygon', coordinates: [] }), null);
});

test('geometrias aceitas mantêm a semântica de linha, ponto e área', () => {
  assert.equal(isSupportedGeometry({ type: 'LineString', coordinates: [[-35, -8], [-34, -8]] }), true);
  assert.equal(isSupportedGeometry({ type: 'MultiLineString', coordinates: [[[-35, -8], [-34, -8]]] }), true);
  assert.equal(isSupportedGeometry({ type: 'Point', coordinates: [-35, -8] }), true);
  assert.equal(isSupportedGeometry({ type: 'Point', coordinates: [181, 0] }), false);
  assert.equal(isSupportedGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }), false);
});

test('seleção hierárquica rejeita pais incompatíveis e limpa descendentes', () => {
  const base: GeographicSearchResult = {
    id: 'test', provider: 'photon', sourceId: null, name: 'Brasil', label: 'Brasil', type: 'country',
    latitude: 0, longitude: 0, boundingBox: null, country: 'Brasil', region: null, city: null,
    district: null, street: null, houseNumber: null, postalCode: null, attribution: 'OSM',
    approximate: true, fetchedAt: '2026-01-01', cached: false,
  };
  const region: GeographicSearchResult = { ...base, id: 'pe', name: 'Pernambuco', type: 'region', region: 'Pernambuco' };
  const city: GeographicSearchResult = { ...region, id: 'recife', name: 'Recife', type: 'city', city: 'Recife' };
  let selection = selectLocationLevel({}, 'country', base);
  selection = selectLocationLevel(selection, 'region', region);
  assert.equal(matchesLocationParents('city', city, selection), true);
  assert.equal(matchesLocationParents('city', { ...city, region: 'Bahia' }, selection), false);
  assert.equal(matchesLocationParents('city', { ...city, region: null }, selection), false);
  selection = selectLocationLevel(selection, 'city', city);
  selection = selectLocationLevel(selection, 'region', null);
  assert.deepEqual(Object.keys(selection), ['country']);
  assert.deepEqual(selectLocationLevel({}, 'city', city), {});
});

function photonResponse(
  features: unknown[],
  init: ResponseInit = {},
): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features,
    }),
    {
      status: 200,
      ...init,
    },
  );
}

function feature(
  id: number,
  coordinates: [number, number] = [
    -46.6333,
    -23.5505,
  ],
): unknown {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates,
    },
    properties: {
      osm_type: 'N',
      osm_id: id,
      name: `Lugar ${id}`,
      type: 'city',
      city: 'São Paulo',
      state: 'São Paulo',
      country: 'Brasil',
    },
  };
}

function service(
  fetchTransport: typeof globalThis.fetch,
  online = true,
  timeoutMs?: number,
): GeographicSearchService {
  return new GeographicSearchService({
    fetch: fetchTransport,
    isOnline: () => online,
    now: () => Date.now(),
    requestIntervalMs: 0,
    timeoutMs,
  });
}

function errorCode(
  response: Awaited<
    ReturnType<
      GeographicSearchService['search']
    >
  >,
): string | null {
  return 'error' in response
    ? response.error.code
    : null;
}

test(
  'classifica entradas locais sem enviar busca geográfica',
  () => {
    assert.deepEqual(
      classifyUniversalSearch('> abrir ip'),
      {
        kind: 'command',
        value: 'abrir ip',
      },
    );
    assert.equal(
      classifyUniversalSearch('8.8.8.8').kind,
      'ip',
    );
    assert.deepEqual(
      classifyUniversalSearch(
        '-23.5505, -46.6333',
      ),
      {
        kind: 'coordinate',
        latitude: -23.5505,
        longitude: -46.6333,
      },
    );
    assert.equal(
      classifyUniversalSearch(
        'example.com',
      ).kind,
      'domain',
    );
    assert.deepEqual(
      classifyUniversalSearch('ru'),
      {
        kind: 'geographic',
        value: 'ru',
        ready: false,
      },
    );
  },
);

test(
  'aceita coordenadas decimais, geo URI e DMS válidas',
  () => {
    assert.equal(
      createCoordinateResult(
        -23.5505,
        -46.6333,
      ).provider,
      'local',
    );
    assert.deepEqual(
      parseUniversalCoordinates(
        'geo:-23.5505,-46.6333',
      ),
      {
        latitude: -23.5505,
        longitude: -46.6333,
      },
    );
    const dms = parseUniversalCoordinates(
      '23° 33\' 1.8" S, 46° 37\' 59.9" W',
    );
    assert.ok(dms);
    assert.ok(
      Math.abs(dms.latitude + 23.5505) <
        0.001,
    );
    assert.equal(
      parseUniversalCoordinates(
        '91, 181',
      ),
      null,
    );
    assert.equal(
      parseUniversalCoordinates(
        '23° 99\' 0" S, 46° 0\' 0" W',
      ),
      null,
    );
  },
);

test(
  'mede distância e azimute inclusive no antimeridiano',
  () => {
    const oneDegree = distanceMeters(
      [0, 0],
      [1, 0],
    );
    assert.ok(oneDegree > 111_000);
    assert.ok(oneDegree < 112_000);
    assert.ok(
      distanceMeters(
        [179.9, 0],
        [-179.9, 0],
      ) < 23_000,
    );
    assert.ok(
      Math.abs(
        bearingDegrees(
          [0, 0],
          [1, 0],
        ) - 90,
      ) < 0.01,
    );
  },
);

test(
  'mede área geodésica aproximada e cruza o antimeridiano com segurança',
  () => {
    const square = polygonAreaSquareMeters([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    assert.ok(square > 12_000_000_000);
    assert.ok(square < 13_000_000_000);
    assert.equal(
      polygonAreaSquareMeters([[0, 0], [1, 0]]),
      0,
    );
    const antimeridian = polygonAreaSquareMeters([
      [179.9, 0],
      [-179.9, 0],
      [-179.9, 0.2],
      [179.9, 0.2],
    ]);
    assert.ok(Number.isFinite(antimeridian));
    assert.ok(antimeridian > 400_000_000);
    assert.ok(antimeridian < 600_000_000);
  },
);

test(
  'valida GeoJSON com limites e relatório de rejeição',
  () => {
    const preview = previewGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'válido',
              nested: { ignored: true },
            },
            geometry: {
              type: 'Point',
              coordinates: [-46, -23],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [Infinity, 0],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiPoint',
              coordinates: [[0, 0]],
            },
          },
        ],
      }),
    );

    assert.equal(preview.accepted.length, 1);
    assert.equal(preview.rejected, 2);
    assert.deepEqual(
      preview.accepted[0].properties,
      { name: 'válido' },
    );
    assert.equal(
      previewGeoJson('{').accepted.length,
      0,
    );
    assert.equal(MAX_GEOJSON_FEATURES, 500);
  },
);

test(
  'rejeita contratos IPC hostis e coordenadas não finitas',
  () => {
    for (const requestId of [
      null,
      '',
      'x'.repeat(129),
    ]) {
      assert.equal(
        parseGeographicRequestId(requestId),
        null,
      );
    }

    for (const value of [
      null,
      [],
      'query',
      {},
      {
        requestId: 'ok',
        query: 'ab',
        filter: 'hostile',
      },
      {
        requestId: 'ok',
        query: 'cidade',
        viewport: {
          west: NaN,
          south: 0,
          east: 1,
          north: 1,
        },
      },
    ]) {
      assert.equal(
        parseGeographicSearchRequest(value),
        null,
      );
    }

    assert.equal(
      parseGeographicReverseRequest({
        requestId: 'ok',
        latitude: Infinity,
        longitude: 0,
      }),
      null,
    );
    assert.ok(
      parseGeographicSearchRequest({
        requestId: 'ok',
        query: '  São   Paulo  ',
        filter: 'city',
      }),
    );
  },
);

test(
  'normaliza, filtra, deduplica e limita Photon a três sugestões',
  async () => {
    let capturedUrl = '';
    const searchService = service(
      (async (input) => {
        capturedUrl = String(input);
        return photonResponse([
          feature(1),
          feature(1),
          feature(2),
          feature(3),
          feature(4),
        ]);
      }) as typeof fetch,
    );
    const response = await searchService.search({
      requestId: 'search-1',
      query: 'São Paulo',
      filter: 'city',
      viewport: {
        west: -47,
        south: -24,
        east: -46,
        north: -23,
      },
      restrictToViewport: true,
    });

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.results.length, 3);
      assert.equal(
        response.results[0].provider,
        'photon',
      );
      assert.equal(
        response.results[0].approximate,
        true,
      );
    }
    assert.match(capturedUrl, /bbox=/u);
    assert.match(capturedUrl, /limit=10/u);
    assert.match(capturedUrl, /lang=en/u);
  },
);

test(
  'usa cache curto sem repetir a chamada externa',
  async () => {
    let calls = 0;
    const searchService = service(
      (async () => {
        calls += 1;
        return photonResponse([feature(1)]);
      }) as typeof fetch,
    );
    const request = {
      requestId: 'cache-1',
      query: 'Recife',
    };
    const first = await searchService.search(
      request,
    );
    const second = await searchService.search({
      ...request,
      requestId: 'cache-2',
    });

    assert.equal(calls, 1);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(
        second.results[0].cached,
        true,
      );
    }
    searchService.clearCache();
    await searchService.search({
      ...request,
      requestId: 'cache-3',
    });
    assert.equal(calls, 2);
  },
);

test(
  'mantém falhas de rede e payload dentro do contrato seguro',
  async () => {
    const offline = await service(
      (async () => photonResponse([])) as typeof fetch,
      false,
    ).search({
      requestId: 'offline',
      query: 'Recife',
    });
    assert.deepEqual(
      errorCode(offline),
      'offline',
    );

    for (const [name, response, code] of [
      [
        'rate limit',
        new Response('', { status: 429 }),
        'rate-limited',
      ],
      [
        'json inválido',
        new Response('{'),
        'invalid-response',
      ],
      [
        'payload incompatível',
        new Response('{}'),
        'invalid-response',
      ],
    ] as const) {
      const result = await service(
        (async () => response) as typeof fetch,
      ).search({
        requestId: name,
        query: 'Recife',
      });
      assert.equal(
        errorCode(result),
        code,
      );
    }
  },
);

test(
  'cancelamento encerra uma busca pendente sem rejeição',
  async () => {
    const searchService = service(
      ((_input, init) => new Promise<Response>(
        (_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(
              new DOMException(
                'aborted',
                'AbortError',
              ),
            ),
            { once: true },
          );
        },
      )) as typeof fetch,
    );
    const pending = searchService.search({
      requestId: 'cancel-me',
      query: 'Recife',
    });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.equal(
      searchService.cancel('cancel-me'),
      true,
    );
    const response = await pending;
    assert.equal(
      errorCode(response),
      'cancelled',
    );
    assert.equal(
      searchService.cancel('missing'),
      false,
    );
  },
);

test(
  'timeout encerra transporte pendente sem rejeição',
  async () => {
    const timeoutService = service(
      ((_input, init) => new Promise<Response>(
        (_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(
              new DOMException(
                'timeout',
                'AbortError',
              ),
            ),
            { once: true },
          );
        },
      )) as typeof fetch,
      true,
      5,
    );
    const response = await timeoutService.search({
      requestId: 'timeout',
      query: 'Recife',
    });

    assert.equal(errorCode(response), 'timeout');
  },
);
