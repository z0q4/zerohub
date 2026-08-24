import {
  ipcMain,
} from 'electron';

import {
  GEOGRAPHIC_SEARCH_MAX_QUERY_LENGTH,
} from '../../shared/geographic-search/geographic-search.types';
import {
  hasValidCoordinates,
  isValidBoundingBox,
  normalizeSearchQuery,
} from '../../shared/geographic-search/geographic-search.validation';
import {
  geographicSearchService,
} from '../services/geographic-search.service';

import type {
  GeographicReverseRequest,
  GeographicReverseResponse,
  GeographicSearchFilter,
  GeographicSearchRequest,
  GeographicSearchResponse,
} from '../../shared/geographic-search/geographic-search.types';

const FILTERS:
  GeographicSearchFilter[] = [
    'all',
    'address',
    'street',
    'neighbourhood',
    'city',
    'poi',
  ];

function invalidResponse(
  message: string,
): GeographicSearchResponse &
  GeographicReverseResponse {
  return {
    ok: false,
    error: {
      code: 'invalid-request',
      message,
    },
  };
}

export function parseGeographicRequestId(
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128
  )
    ? value
    : null;
}

export function parseGeographicSearchRequest(
  value: unknown,
): GeographicSearchRequest | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const request = value as Partial<
    GeographicSearchRequest
  >;
  const requestId =
    parseGeographicRequestId(
      request.requestId,
    );
  const query = normalizeSearchQuery(
    request.query,
  );
  const filter = request.filter ?? 'all';
  const language =
    typeof request.language === 'string' &&
    /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(
      request.language,
    )
      ? request.language
      : 'pt';

  if (
    !requestId ||
    !query ||
    query.length >
      GEOGRAPHIC_SEARCH_MAX_QUERY_LENGTH ||
    !FILTERS.includes(filter) ||
    (
      request.viewport !== undefined &&
      request.viewport !== null &&
      !isValidBoundingBox(
        request.viewport,
      )
    ) ||
    (
      request.restrictToViewport !==
        undefined &&
      typeof request.restrictToViewport !==
        'boolean'
    )
  ) {
    return null;
  }

  return {
    requestId,
    query,
    language,
    filter,
    viewport:
      request.viewport ?? null,
    restrictToViewport:
      request.restrictToViewport ??
      false,
  };
}

export function parseGeographicReverseRequest(
  value: unknown,
): GeographicReverseRequest | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const request = value as Partial<
    GeographicReverseRequest
  >;
  const requestId =
    parseGeographicRequestId(
      request.requestId,
    );

  if (
    !requestId ||
    !hasValidCoordinates(
      request.latitude,
      request.longitude,
    )
  ) {
    return null;
  }

  return {
    requestId,
    latitude: request.latitude,
    longitude: request.longitude,
    language:
      typeof request.language ===
        'string' &&
      /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(
        request.language,
      )
        ? request.language
        : 'pt',
  };
}

export function registerGeographicSearchIpcHandlers():
  void {
  ipcMain.handle(
    'geographic-search:search',
    async (_event, rawRequest: unknown) => {
      const request =
        parseGeographicSearchRequest(
          rawRequest,
        );

      return request
        ? geographicSearchService.search(
          request,
        )
        : invalidResponse(
          'A solicitação de busca geográfica é inválida.',
        );
    },
  );

  ipcMain.handle(
    'geographic-search:reverse',
    async (_event, rawRequest: unknown) => {
      const request =
        parseGeographicReverseRequest(
          rawRequest,
        );

      return request
        ? geographicSearchService.reverse(
          request,
        )
        : invalidResponse(
          'A solicitação de endereço aproximado é inválida.',
        );
    },
  );

  ipcMain.handle(
    'geographic-search:cancel',
    (_event, rawRequestId: unknown) => {
      const requestId =
        parseGeographicRequestId(
          rawRequestId,
        );

      return requestId
        ? geographicSearchService.cancel(
          requestId,
        )
        : false;
    },
  );

  ipcMain.handle(
    'geographic-search:clear-cache',
    () => {
      geographicSearchService.clearCache();
      return true;
    },
  );
}
