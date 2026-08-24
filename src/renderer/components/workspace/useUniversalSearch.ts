import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  GEOGRAPHIC_SEARCH_MAX_RESULTS,
} from '../../../shared/geographic-search/geographic-search.types';
import {
  classifyUniversalSearch,
  hasValidCoordinates,
  isValidBoundingBox,
} from '../../../shared/geographic-search/geographic-search.validation';
import {
  MODULE_REGISTRY,
  isModuleAvailableInMode,
} from '../../../shared/modules/module.registry';

import type {
  GeographicBoundingBox,
  GeographicReverseResponse,
  GeographicSearchErrorCode,
  GeographicSearchFilter,
  GeographicSearchResponse,
  GeographicSearchResult,
  GeographicSearchResultType,
  UniversalSearchClassification,
} from '../../../shared/geographic-search/geographic-search.types';
import type {
  WorkspaceMode,
} from '../../../shared/modules/module.types';

export type UniversalSearchFeedback = {
  tone: 'info' | 'success' | 'error';
  message: string;
};

export type UniversalSearchHistoryItem = {
  id: string;
  result: GeographicSearchResult;
  usedAt: string;
};

export type UniversalSearchState = {
  busy: boolean;
  classification:
    UniversalSearchClassification;
  favorites: GeographicSearchResult[];
  feedback:
    UniversalSearchFeedback | null;
  filter: GeographicSearchFilter;
  history: UniversalSearchHistoryItem[];
  historyEnabled: boolean;
  networkOnline: boolean;
  query: string;
  restrictToViewport: boolean;
  suggestions: GeographicSearchResult[];

  cancel(): void;
  clearCache(): Promise<boolean>;
  clearHistory(): void;
  removeHistory(id: string): void;
  retry(): void;
  selectResult(
    result: GeographicSearchResult,
  ): void;
  setFilter(
    filter: GeographicSearchFilter,
  ): void;
  setHistoryEnabled(enabled: boolean): void;
  setQuery(query: string): void;
  setRestrictToViewport(enabled: boolean): void;
  toggleFavorite(
    result: GeographicSearchResult,
  ): void;
  isFavorite(resultId: string): boolean;
  reverse(
    latitude: number,
    longitude: number,
  ): Promise<GeographicSearchResult | null>;
};

const HISTORY_KEY =
  'zerohub:geographic-search-history:v1';
const FAVORITES_KEY =
  'zerohub:geographic-search-favorites:v1';
const PREFERENCES_KEY =
  'zerohub:geographic-search-preferences:v1';
const MAX_HISTORY_ITEMS = 20;
const MAX_FAVORITES = 50;
const DEBOUNCE_MS = 300;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nullableText(
  value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.length > 240
  ) {
    return undefined;
  }

  return value.trim() || null;
}

function isResultType(
  value: unknown,
): value is GeographicSearchResultType {
  return [
    'address',
    'street',
    'neighbourhood',
    'city',
    'region',
    'country',
    'poi',
    'coordinate',
    'unknown',
  ].includes(String(value));
}

function parseResult(
  value: unknown,
): GeographicSearchResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const country = nullableText(
    value.country,
  );
  const region = nullableText(
    value.region,
  );
  const city = nullableText(value.city);
  const district = nullableText(
    value.district,
  );
  const street = nullableText(
    value.street,
  );
  const houseNumber = nullableText(
    value.houseNumber,
  );
  const postalCode = nullableText(
    value.postalCode,
  );

  if (
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 260 ||
    (
      value.provider !== 'photon' &&
      value.provider !== 'local'
    ) ||
    (
      value.sourceId !== null &&
      typeof value.sourceId !== 'string'
    ) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 160 ||
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    value.label.length > 500 ||
    !isResultType(value.type) ||
    !hasValidCoordinates(
      value.latitude,
      value.longitude,
    ) ||
    (
      value.boundingBox !== null &&
      !isValidBoundingBox(
        value.boundingBox,
      )
    ) ||
    country === undefined ||
    region === undefined ||
    city === undefined ||
    district === undefined ||
    street === undefined ||
    houseNumber === undefined ||
    postalCode === undefined ||
    typeof value.attribution !==
      'string' ||
    !value.attribution.trim() ||
    value.approximate !== true ||
    typeof value.fetchedAt !==
      'string' ||
    !Number.isFinite(
      Date.parse(value.fetchedAt),
    ) ||
    typeof value.cached !== 'boolean'
  ) {
    return null;
  }

  return {
    id: value.id,
    provider: value.provider,
    sourceId:
      typeof value.sourceId ===
        'string'
        ? value.sourceId
        : null,
    name: value.name.trim(),
    label: value.label.trim(),
    type: value.type,
    latitude: value.latitude as number,
    longitude: value.longitude as number,
    boundingBox:
      value.boundingBox as
      GeographicBoundingBox | null,
    country,
    region,
    city,
    district,
    street,
    houseNumber,
    postalCode,
    attribution:
      value.attribution.trim(),
    approximate: true,
    fetchedAt: value.fetchedAt,
    cached: value.cached,
  };
}

function isErrorCode(
  value: unknown,
): value is GeographicSearchErrorCode {
  return [
    'cancelled',
    'invalid-request',
    'offline',
    'rate-limited',
    'timeout',
    'unavailable',
    'invalid-response',
  ].includes(String(value));
}

export function parseGeographicSearchResponse(
  value: unknown,
): GeographicSearchResponse | null {
  if (
    !isRecord(value) ||
    typeof value.ok !== 'boolean'
  ) {
    return null;
  }

  if (value.ok === false) {
    if (
      !isRecord(value.error) ||
      !isErrorCode(value.error.code) ||
      typeof value.error.message !==
        'string' ||
      !value.error.message.trim()
    ) {
      return null;
    }

    return {
      ok: false,
      error: {
        code: value.error.code,
        message: value.error.message.trim(),
      },
    };
  }

  if (
    value.provider !== 'photon' ||
    !Array.isArray(value.results) ||
    value.results.length >
      GEOGRAPHIC_SEARCH_MAX_RESULTS
  ) {
    return null;
  }

  const results = value.results.map(
    parseResult,
  );

  if (
    results.some(
      (result) => result === null,
    )
  ) {
    return null;
  }

  return {
    ok: true,
    provider: 'local',
    results:
      results as GeographicSearchResult[],
  };
}

export function parseGeographicReverseResponse(
  value: unknown,
): GeographicReverseResponse | null {
  const response =
    parseGeographicSearchResponse(
      isRecord(value) &&
      value.ok === true
        ? {
          ok: true,
          provider: value.provider,
          results: [value.result],
        }
        : value,
    );

  if (!response) {
    return null;
  }

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
    : null;
}

export function createCoordinateResult(
  latitude: number,
  longitude: number,
): GeographicSearchResult {
  return {
    id:
      `coordinate:${latitude}:${longitude}`,
    provider: 'local',
    sourceId: null,
    name: 'Coordenada informada',
    label:
      `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    type: 'coordinate',
    latitude,
    longitude,
    boundingBox: null,
    country: null,
    region: null,
    city: null,
    district: null,
    street: null,
    houseNumber: null,
    postalCode: null,
    attribution:
      'Coordenada fornecida pelo usuário',
    approximate: true,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

function readStoredResults(
  key: string,
  maxItems: number,
): GeographicSearchResult[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) ?? '[]',
    ) as unknown;

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(parseResult)
      .filter(
        (
          result,
        ): result is GeographicSearchResult =>
          result !== null,
      )
      .slice(0, maxItems);
  } catch {
    return [];
  }
}

function readHistory():
  UniversalSearchHistoryItem[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(
        HISTORY_KEY,
      ) ?? '[]',
    ) as unknown;

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }

        const result = parseResult(
          item.result,
        );

        if (
          !result ||
          typeof item.id !== 'string' ||
          typeof item.usedAt !== 'string' ||
          !Number.isFinite(
            Date.parse(item.usedAt),
          )
        ) {
          return null;
        }

        return {
          id: item.id,
          result,
          usedAt: item.usedAt,
        };
      })
      .filter(
        (
          item,
        ): item is UniversalSearchHistoryItem =>
          item !== null,
      )
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function readHistoryPreference(): boolean {
  try {
    const value = JSON.parse(
      localStorage.getItem(
        PREFERENCES_KEY,
      ) ?? '{}',
    ) as unknown;

    return isRecord(value) &&
      value.historyEnabled === true;
  } catch {
    return false;
  }
}

function writeStorage(
  key: string,
  value: unknown,
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Persistência local indisponível; a sessão continua funcional.
  }
}

function removeStorage(
  key: string,
): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Persistência local indisponível; a sessão continua funcional.
  }
}

function cancelSafely(
  requestId: string,
): void {
  try {
    const request = window.zeroHub
      ?.geographicSearch
      ?.cancel?.(requestId);

    if (request) {
      void request.catch(
        (): void => undefined,
      );
    }
  } catch {
    // A janela pode estar sendo desmontada.
  }
}

export function useUniversalSearch(
  viewport: GeographicBoundingBox | null,
  workspaceMode: WorkspaceMode,
): UniversalSearchState {
  const mountedRef = useRef(true);
  const requestIdRef =
    useRef<string | null>(null);
  const retryRevisionRef = useRef(0);
  const [query, setQueryValue] =
    useState('');
  const [busy, setBusy] =
    useState(false);
  const [feedback, setFeedback] =
    useState<
      UniversalSearchFeedback | null
    >(null);
  const [filter, setFilter] =
    useState<GeographicSearchFilter>(
      'all',
    );
  const [restrictToViewport,
    setRestrictToViewport] =
    useState(false);
  const [suggestions, setSuggestions] =
    useState<GeographicSearchResult[]>(
      [],
    );
  const [history, setHistory] =
    useState<UniversalSearchHistoryItem[]>(
      () => readHistoryPreference()
        ? readHistory()
        : [],
    );
  const [favorites, setFavorites] =
    useState<GeographicSearchResult[]>(
      () => readStoredResults(
        FAVORITES_KEY,
        MAX_FAVORITES,
      ),
    );
  const [historyEnabled,
    setHistoryEnabledState] =
    useState(readHistoryPreference);
  const [networkOnline,
    setNetworkOnline] = useState(
      () => navigator.onLine,
    );
  const [retryRevision,
    setRetryRevision] = useState(0);
  const classification = useMemo(
    () => classifyUniversalSearch(
      query,
    ),
    [query],
  );
  const hasExactModuleMatch =
    useMemo(() => {
      if (
        classification.kind !==
          'geographic'
      ) {
        return false;
      }

      const normalized =
        classification.value
          .toLocaleLowerCase('pt-BR');

      return MODULE_REGISTRY.some(
        (module) =>
          isModuleAvailableInMode(
            module,
            workspaceMode,
          ) &&
          (
            module.id.toLowerCase() ===
              normalized ||
            module.name
              .toLocaleLowerCase('pt-BR') ===
              normalized ||
            module.abbreviation
              .toLocaleLowerCase('pt-BR') ===
              normalized
          ),
      );
    }, [
      classification,
      workspaceMode,
    ]);

  const cancel = useCallback(() => {
    const requestId =
      requestIdRef.current;

    requestIdRef.current = null;
    setBusy(false);

    if (requestId) {
      cancelSafely(requestId);
    }
  }, []);

  useEffect(() => {
    const handleOnline = (): void => {
      setNetworkOnline(true);
    };
    const handleOffline = (): void => {
      setNetworkOnline(false);
    };

    window.addEventListener(
      'online',
      handleOnline,
    );
    window.addEventListener(
      'offline',
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      );
      window.removeEventListener(
        'offline',
        handleOffline,
      );
    };
  }, []);

  useEffect(() => {
    if (
      classification.kind !==
        'geographic' ||
      !classification.ready ||
      hasExactModuleMatch
    ) {
      cancel();
      setSuggestions([]);
      setFeedback(
        !hasExactModuleMatch &&
        classification.kind ===
          'geographic' &&
        classification.value
          ? {
            tone: 'info',
            message:
              'Digite pelo menos três caracteres para pesquisar lugares.',
          }
          : null,
      );
      return undefined;
    }

    if (!networkOnline) {
      cancel();
      setSuggestions([]);
      setFeedback({
        tone: 'error',
        message:
          'Sem conexão. A busca local continua disponível; reconecte para pesquisar lugares.',
      });
      return undefined;
    }

    const timer = window.setTimeout(
      () => {
        cancel();

        const api = window.zeroHub
          ?.geographicSearch;

        if (
          !api ||
          typeof api.search !== 'function'
        ) {
          setFeedback({
            tone: 'error',
            message:
              'A busca geográfica não está disponível nesta janela.',
          });
          return;
        }

        const requestId =
          crypto.randomUUID();
        requestIdRef.current = requestId;
        setBusy(true);
        setFeedback({
          tone: 'info',
          message:
            'Consultando Photon/OpenStreetMap…',
        });

        void api.search({
          requestId,
          query: classification.value,
          language: 'pt',
          filter,
          viewport,
          restrictToViewport,
        }).then((rawResponse) => {
          if (
            !mountedRef.current ||
            requestIdRef.current !==
              requestId
          ) {
            return;
          }

          const response =
            parseGeographicSearchResponse(
              rawResponse as unknown,
            );

          if (!response) {
            setSuggestions([]);
            setFeedback({
              tone: 'error',
              message:
                'O provider retornou uma resposta incompatível.',
            });
            return;
          }

          if (response.ok === false) {
            setSuggestions([]);
            setFeedback({
              tone:
                response.error.code ===
                  'cancelled'
                  ? 'info'
                  : 'error',
              message:
                response.error.message,
            });
            return;
          }

          setSuggestions(
            response.results,
          );
          setFeedback({
            tone:
              response.results.length > 0
                ? 'success'
                : 'info',
            message:
              response.results.length > 0
                ? `${response.results.length} sugestão(ões) encontrada(s).`
                : 'Nenhum lugar encontrado.',
          });
        }).catch(() => {
          if (
            mountedRef.current &&
            requestIdRef.current ===
              requestId
          ) {
            setSuggestions([]);
            setFeedback({
              tone: 'error',
              message:
                'Não foi possível concluir a busca geográfica.',
            });
          }
        }).finally(() => {
          if (
            mountedRef.current &&
            requestIdRef.current ===
              requestId
          ) {
            requestIdRef.current = null;
            setBusy(false);
          }
        });
      },
      DEBOUNCE_MS,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    cancel,
    classification,
    filter,
    hasExactModuleMatch,
    networkOnline,
    restrictToViewport,
    retryRevision,
    viewport,
  ]);

  const selectResult = useCallback(
    (result: GeographicSearchResult) => {
      if (!historyEnabled) {
        return;
      }

      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          result,
          usedAt: new Date().toISOString(),
        },
        ...current.filter(
          (item) =>
            item.result.id !== result.id,
        ),
      ].slice(0, MAX_HISTORY_ITEMS));
    },
    [historyEnabled],
  );

  useEffect(() => {
    if (historyEnabled) {
      writeStorage(
        HISTORY_KEY,
        history,
      );
    } else {
      removeStorage(
        HISTORY_KEY,
      );
    }
  }, [history, historyEnabled]);

  useEffect(() => {
    writeStorage(
      FAVORITES_KEY,
      favorites,
    );
  }, [favorites]);

  useEffect(() => {
    writeStorage(
      PREFERENCES_KEY,
      {
        historyEnabled,
      },
    );
  }, [historyEnabled]);

  const reverse = useCallback(
    async (
      latitude: number,
      longitude: number,
    ): Promise<GeographicSearchResult | null> => {
      if (
        !hasValidCoordinates(
          latitude,
          longitude,
        )
      ) {
        setFeedback({
          tone: 'error',
          message:
            'As coordenadas para reverse geocoding são inválidas.',
        });
        return null;
      }

      cancel();
      const api = window.zeroHub
        ?.geographicSearch;

      if (!api) {
        setFeedback({
          tone: 'error',
          message:
            'Reverse geocoding indisponível nesta janela.',
        });
        return null;
      }

      const requestId =
        crypto.randomUUID();
      requestIdRef.current = requestId;
      setBusy(true);
      setFeedback({
        tone: 'info',
        message:
          'Enviando esta coordenada ao Photon para obter endereço aproximado…',
      });

      try {
        const rawResponse =
          await api.reverse({
            requestId,
            latitude,
            longitude,
            language: 'pt',
          });

        if (
          !mountedRef.current ||
          requestIdRef.current !==
            requestId
        ) {
          return null;
        }

        const response =
          parseGeographicReverseResponse(
            rawResponse as unknown,
          );

        if (!response) {
          setFeedback({
            tone: 'error',
            message:
              'O provider retornou um endereço incompatível.',
          });
          return null;
        }

        if (response.ok === false) {
          setFeedback({
            tone: 'error',
            message: response.error.message,
          });
          return null;
        }

        selectResult(response.result);
        setFeedback({
          tone: 'success',
          message:
            'Endereço aproximado encontrado.',
        });
        return response.result;
      } catch {
        if (mountedRef.current) {
          setFeedback({
            tone: 'error',
            message:
              'Não foi possível obter o endereço aproximado.',
          });
        }
        return null;
      } finally {
        if (
          mountedRef.current &&
          requestIdRef.current ===
            requestId
        ) {
          requestIdRef.current = null;
          setBusy(false);
        }
      }
    },
    [cancel, selectResult],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, [cancel]);

  return {
    busy,
    classification,
    favorites,
    feedback,
    filter,
    history,
    historyEnabled,
    networkOnline,
    query,
    restrictToViewport,
    suggestions,
    cancel,
    clearCache: async () => {
      try {
        await window.zeroHub
          .geographicSearch
          .clearCache();

        if (mountedRef.current) {
          setFeedback({
            tone: 'success',
            message:
              'Cache geográfico limpo.',
          });
        }
        return true;
      } catch {
        if (mountedRef.current) {
          setFeedback({
            tone: 'error',
            message:
              'Não foi possível limpar o cache geográfico.',
          });
        }
        return false;
      }
    },
    clearHistory: () => {
      setHistory([]);
    },
    removeHistory: (id) => {
      setHistory((current) =>
        current.filter(
          (item) => item.id !== id,
        ),
      );
    },
    retry: () => {
      retryRevisionRef.current += 1;
      setRetryRevision(
        retryRevisionRef.current,
      );
    },
    selectResult,
    setFilter,
    setHistoryEnabled: (
      enabled,
    ) => {
      setHistoryEnabledState(enabled);
      if (!enabled) {
        setHistory([]);
      }
    },
    setQuery: (nextQuery) => {
      setQueryValue(nextQuery);
      setFeedback(null);
    },
    setRestrictToViewport,
    toggleFavorite: (result) => {
      setFavorites((current) =>
        current.some(
          (item) => item.id === result.id,
        )
          ? current.filter(
            (item) => item.id !== result.id,
          )
          : [result, ...current]
            .slice(0, MAX_FAVORITES),
      );
    },
    isFavorite: (resultId) =>
      favorites.some(
        (item) => item.id === resultId,
      ),
    reverse,
  };
}
