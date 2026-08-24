import {
  net,
} from 'electron';

import {
  GEOGRAPHIC_SEARCH_MAX_RESULTS,
} from '../../shared/geographic-search/geographic-search.types';
import {
  hasValidCoordinates,
  isValidBoundingBox,
} from '../../shared/geographic-search/geographic-search.validation';

import type {
  GeographicBoundingBox,
  GeographicReverseRequest,
  GeographicReverseResponse,
  GeographicSearchErrorCode,
  GeographicSearchFilter,
  GeographicSearchRequest,
  GeographicSearchResponse,
  GeographicSearchResult,
  GeographicSearchResultType,
} from '../../shared/geographic-search/geographic-search.types';

const PHOTON_ORIGIN =
  'https://photon.komoot.io';
const SEARCH_ENDPOINT =
  `${PHOTON_ORIGIN}/api/`;
const REVERSE_ENDPOINT =
  `${PHOTON_ORIGIN}/reverse`;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_LENGTH =
  1_048_576;
const CACHE_TTL_MS = 120_000;
const MAX_CACHE_ITEMS = 100;
const MIN_REQUEST_INTERVAL_MS = 350;
const PHOTON_ATTRIBUTION =
  'Dados © OpenStreetMap contributors · busca Photon';
const PHOTON_LANGUAGES = new Set([
  'de',
  'en',
  'fr',
  'it',
]);

type FetchTransport = {
  fetch: typeof net.fetch;
  isOnline(): boolean;
  now(): number;
  requestIntervalMs?: number;
  timeoutMs?: number;
};

type PhotonFeature = {
  type?: unknown;
  geometry?: unknown;
  properties?: unknown;
  bbox?: unknown;
};

type CacheEntry = {
  expiresAt: number;
  results: GeographicSearchResult[];
};

function failure(
  code: GeographicSearchErrorCode,
  message: string,
): GeographicSearchResponse &
  GeographicReverseResponse {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function optionalText(
  value: unknown,
  maxLength = 240,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized
    ? normalized.slice(0, maxLength)
    : null;
}

function normalizeType(
  properties: Record<string, unknown>,
): GeographicSearchResultType {
  const type = optionalText(
    properties.type,
    40,
  )?.toLowerCase();
  const osmKey = optionalText(
    properties.osm_key,
    40,
  )?.toLowerCase();

  if (
    osmKey === 'amenity' ||
    osmKey === 'tourism' ||
    osmKey === 'shop' ||
    osmKey === 'leisure'
  ) {
    return 'poi';
  }

  if (
    type === 'house' ||
    type === 'address'
  ) {
    return 'address';
  }

  if (
    type === 'street' ||
    type === 'highway'
  ) {
    return 'street';
  }

  if (
    type === 'district' ||
    type === 'neighbourhood' ||
    type === 'suburb' ||
    type === 'locality'
  ) {
    return 'neighbourhood';
  }

  if (
    type === 'city' ||
    type === 'town' ||
    type === 'village' ||
    type === 'municipality'
  ) {
    return 'city';
  }

  if (
    type === 'state' ||
    type === 'county' ||
    type === 'region'
  ) {
    return 'region';
  }

  if (type === 'country') {
    return 'country';
  }

  return 'unknown';
}

function parseBoundingBox(
  value: unknown,
): GeographicBoundingBox | null {
  if (
    !Array.isArray(value) ||
    value.length !== 4
  ) {
    return null;
  }

  const [west, south, east, north] =
    value.map(Number);
  const box = {
    west,
    south,
    east,
    north,
  };

  return isValidBoundingBox(box)
    ? box
    : null;
}

function matchesFilter(
  resultType: GeographicSearchResultType,
  filter: GeographicSearchFilter,
): boolean {
  return (
    filter === 'all' ||
    resultType === filter
  );
}

function normalizePhotonLanguage(
  language: string | undefined,
): string {
  const baseLanguage = language
    ?.split('-')[0]
    .toLowerCase();

  return baseLanguage &&
    PHOTON_LANGUAGES.has(baseLanguage)
    ? baseLanguage
    : 'en';
}

function parsePhotonFeature(
  feature: PhotonFeature,
  index: number,
  fetchedAt: string,
): GeographicSearchResult | null {
  if (
    feature.type !== 'Feature' ||
    !isRecord(feature.geometry) ||
    feature.geometry.type !== 'Point' ||
    !Array.isArray(
      feature.geometry.coordinates,
    ) ||
    feature.geometry.coordinates.length < 2 ||
    !isRecord(feature.properties)
  ) {
    return null;
  }

  const longitude = Number(
    feature.geometry.coordinates[0],
  );
  const latitude = Number(
    feature.geometry.coordinates[1],
  );

  if (
    !hasValidCoordinates(
      latitude,
      longitude,
    )
  ) {
    return null;
  }

  const properties = feature.properties;
  const name = optionalText(
    properties.name,
    160,
  ) ?? optionalText(
    properties.street,
    160,
  ) ?? optionalText(
    properties.city,
    160,
  ) ?? 'Local sem nome';
  const houseNumber = optionalText(
    properties.housenumber,
    40,
  );
  const street = optionalText(
    properties.street,
    160,
  );
  const district = optionalText(
    properties.district,
    120,
  ) ?? optionalText(
    properties.locality,
    120,
  );
  const city = optionalText(
    properties.city,
    120,
  );
  const region = optionalText(
    properties.state,
    120,
  ) ?? optionalText(
    properties.county,
    120,
  );
  const country = optionalText(
    properties.country,
    120,
  );
  const postalCode = optionalText(
    properties.postcode,
    40,
  );
  const labelParts = [
    houseNumber && street
      ? `${street}, ${houseNumber}`
      : street,
    district,
    city,
    region,
    country,
  ].filter(
    (item, itemIndex, items) =>
      item !== null &&
      item !== name &&
      items.indexOf(item) === itemIndex,
  );
  const osmType = optionalText(
    properties.osm_type,
    20,
  );
  const osmId =
    typeof properties.osm_id ===
      'number' ||
    typeof properties.osm_id ===
      'string'
      ? String(properties.osm_id)
      : null;

  return {
    id:
      osmType && osmId
        ? `photon:${osmType}:${osmId}`
        : `photon:${longitude}:${latitude}:${index}`,
    provider: 'photon',
    sourceId:
      osmType && osmId
        ? `${osmType}:${osmId}`
        : null,
    name,
    label:
      labelParts.join(' · ') ||
      name,
    type: normalizeType(properties),
    latitude,
    longitude,
    boundingBox:
      parseBoundingBox(feature.bbox) ??
      parseBoundingBox(
        properties.extent,
      ),
    country,
    region,
    city,
    district,
    street,
    houseNumber,
    postalCode,
    attribution: PHOTON_ATTRIBUTION,
    approximate: true,
    fetchedAt,
    cached: false,
  };
}

export class GeographicSearchService {
  private readonly controllers =
    new Map<string, AbortController>();

  private readonly cache =
    new Map<string, CacheEntry>();

  private lastRequestAt = 0;

  constructor(
    private readonly transport:
      FetchTransport = {
        fetch: (...args) =>
          net.fetch(...args),
        isOnline: () => net.isOnline(),
        now: () => Date.now(),
      },
  ) {}

  cancel(requestId: string): boolean {
    const controller =
      this.controllers.get(requestId);

    if (!controller) {
      return false;
    }

    controller.abort();
    this.controllers.delete(requestId);
    return true;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async search(
    request: GeographicSearchRequest,
  ): Promise<GeographicSearchResponse> {
    const cacheKey = JSON.stringify({
      query:
        request.query.toLocaleLowerCase(
          'pt-BR',
        ),
      language: request.language ?? 'pt',
      filter: request.filter ?? 'all',
      viewport: request.viewport ?? null,
      restrict:
        request.restrictToViewport ??
        false,
    });
    const cached = this.cache.get(cacheKey);

    if (
      cached &&
      cached.expiresAt >
        this.transport.now()
    ) {
      return {
        ok: true,
        provider: 'photon',
        results: cached.results.map(
          (result) => ({
            ...result,
            cached: true,
          }),
        ),
      };
    }

    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set(
      'q',
      request.query,
    );
    url.searchParams.set('limit', '10');
    url.searchParams.set(
      'lang',
      normalizePhotonLanguage(
        request.language,
      ),
    );

    if (request.viewport) {
      const centerLatitude =
        (request.viewport.south +
          request.viewport.north) /
        2;
      const centerLongitude =
        (request.viewport.west +
          request.viewport.east) /
        2;
      url.searchParams.set(
        'lat',
        String(centerLatitude),
      );
      url.searchParams.set(
        'lon',
        String(centerLongitude),
      );

      if (request.restrictToViewport) {
        url.searchParams.set(
          'bbox',
          [
            request.viewport.west,
            request.viewport.south,
            request.viewport.east,
            request.viewport.north,
          ].join(','),
        );
      }
    }

    const response = await this.fetchResults(
      request.requestId,
      url,
      request.filter ?? 'all',
    );

    if (response.ok) {
      this.cache.set(cacheKey, {
        expiresAt:
          this.transport.now() +
          CACHE_TTL_MS,
        results: response.results,
      });

      while (
        this.cache.size > MAX_CACHE_ITEMS
      ) {
        const oldest = this.cache
          .keys()
          .next().value as
          | string
          | undefined;

        if (!oldest) {
          break;
        }

        this.cache.delete(oldest);
      }
    }

    return response;
  }

  async reverse(
    request: GeographicReverseRequest,
  ): Promise<GeographicReverseResponse> {
    const url = new URL(REVERSE_ENDPOINT);
    url.searchParams.set(
      'lat',
      String(request.latitude),
    );
    url.searchParams.set(
      'lon',
      String(request.longitude),
    );
    url.searchParams.set(
      'lang',
      normalizePhotonLanguage(
        request.language,
      ),
    );

    const response = await this.fetchResults(
      request.requestId,
      url,
      'all',
    );

    if (response.ok === false) {
      return response;
    }

    const result = response.results[0];

    return result
      ? {
        ok: true,
        provider: 'photon',
        result,
      }
      : failure(
        'unavailable',
        'Nenhum endereço aproximado foi encontrado para esta coordenada.',
      );
  }

  private async fetchResults(
    requestId: string,
    url: URL,
    filter: GeographicSearchFilter,
  ): Promise<GeographicSearchResponse> {
    if (!this.transport.isOnline()) {
      return failure(
        'offline',
        'Sem conexão com a internet. A busca local continua disponível.',
      );
    }

    this.cancel(requestId);
    const controller =
      new AbortController();
    this.controllers.set(
      requestId,
      controller,
    );
    const elapsed =
      this.transport.now() -
      this.lastRequestAt;
    const requestInterval =
      this.transport.requestIntervalMs ??
      MIN_REQUEST_INTERVAL_MS;

    if (elapsed < requestInterval) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(
          resolve,
          requestInterval -
            elapsed,
        );

        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    }

    if (controller.signal.aborted) {
      return failure(
        'cancelled',
        'Pesquisa cancelada.',
      );
    }

    let timedOut = false;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      this.transport.timeoutMs ??
        REQUEST_TIMEOUT_MS,
    );
    this.lastRequestAt =
      this.transport.now();

    try {
      const response =
        await this.transport.fetch(
          url.toString(),
          {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              Accept:
                'application/geo+json, application/json',
              'User-Agent':
                'ZeroHub/0.1.0 Geographic Search',
            },
          },
        );

      if (
        response.url &&
        new URL(response.url).origin !==
          PHOTON_ORIGIN
      ) {
        return failure(
          'invalid-response',
          'O provider redirecionou a consulta para um domínio não autorizado.',
        );
      }

      if (response.status === 429) {
        return failure(
          'rate-limited',
          'O provider limitou temporariamente as pesquisas. Tente novamente mais tarde.',
        );
      }

      if (!response.ok) {
        return failure(
          'unavailable',
          `O provider respondeu com HTTP ${response.status}.`,
        );
      }

      const declaredLength = Number(
        response.headers.get(
          'content-length',
        ) ?? 0,
      );

      if (
        Number.isFinite(declaredLength) &&
        declaredLength >
          MAX_RESPONSE_LENGTH
      ) {
        return failure(
          'invalid-response',
          'A resposta do provider excedeu o limite permitido.',
        );
      }

      const text = await response.text();

      if (
        text.length > MAX_RESPONSE_LENGTH
      ) {
        return failure(
          'invalid-response',
          'A resposta do provider excedeu o limite permitido.',
        );
      }

      let payload: unknown;

      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        return failure(
          'invalid-response',
          'O provider retornou JSON inválido.',
        );
      }

      if (
        !isRecord(payload) ||
        payload.type !==
          'FeatureCollection' ||
        !Array.isArray(payload.features) ||
        payload.features.length > 100
      ) {
        return failure(
          'invalid-response',
          'O provider retornou um payload incompatível.',
        );
      }

      const fetchedAt =
        new Date().toISOString();
      const results = payload.features
        .map((feature, index) =>
          isRecord(feature)
            ? parsePhotonFeature(
              feature,
              index,
              fetchedAt,
            )
            : null,
        )
        .filter(
          (
            result,
          ): result is GeographicSearchResult =>
            result !== null &&
            matchesFilter(
              result.type,
              filter,
            ),
        )
        .filter(
          (result, index, resultsList) =>
            resultsList.findIndex(
              (candidate) =>
                candidate.id ===
                result.id,
            ) === index,
        )
        .slice(
          0,
          GEOGRAPHIC_SEARCH_MAX_RESULTS,
        );

      return {
        ok: true,
        provider: 'photon',
        results,
      };
    } catch (unknownError) {
      if (controller.signal.aborted) {
        return failure(
          timedOut
            ? 'timeout'
            : 'cancelled',
          timedOut
            ? 'A pesquisa geográfica excedeu o tempo limite.'
            : 'Pesquisa cancelada.',
        );
      }

      return failure(
        this.transport.isOnline()
          ? 'unavailable'
          : 'offline',
        this.transport.isOnline()
          ? 'Não foi possível consultar o provider geográfico.'
          : 'Sem conexão com a internet. A busca local continua disponível.',
      );
    } finally {
      clearTimeout(timeout);

      if (
        this.controllers.get(requestId) ===
        controller
      ) {
        this.controllers.delete(requestId);
      }
    }
  }
}

export const geographicSearchService =
  new GeographicSearchService();
