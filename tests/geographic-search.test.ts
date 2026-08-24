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
