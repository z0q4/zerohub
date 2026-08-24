import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  validatePublicIpAddress,
} from '../../../shared/ip-geolocation/ip-address.validation';
import {
  createIpGeolocationSavedActivity,
  createTransientIpResult,
} from './ip-geolocation-activities';
import {
  MAP_MARKER_COLORS,
} from './map-workspace.types';
import {
  hasValidIpGeolocationCoordinates,
} from './ip-geolocation.types';
import {
  useScopedWorkspaceState,
} from './useScopedWorkspaceState';

import type {
  CaseActivity,
  CaseActivityCreateInput,
} from '../../../shared/cases/cases.types';
import type {
  IpGeolocationErrorCode,
  IpGeolocationLookupResponse,
  IpGeolocationProviderResult,
  IpPublicFamilyLookupResponse,
  IpPublicLookupResponse,
} from '../../../shared/ip-geolocation/ip-geolocation.types';
import type {
  IpGeolocationFeedback,
  IpGeolocationHistoryItem,
  IpGeolocationResult,
  IpGeolocationVersionFilter,
  IpPublicFamilyStatus,
} from './ip-geolocation.types';
import type {
  MapMarkerColor,
} from './map-workspace.types';

type UseIpGeolocationIntelligenceOptions = {
  activeCaseId: string | null;
  persistentResults:
    IpGeolocationResult[];

  addActivity(
    input: CaseActivityCreateInput,
  ): Promise<CaseActivity>;
};

export type IpGeolocationIntelligence = {
  allResults: IpGeolocationResult[];
  busy: boolean;
  connectResults: boolean;
  feedback:
    IpGeolocationFeedback | null;
  history: IpGeolocationHistoryItem[];
  input: string;
  open: boolean;
  publicFamilyStatuses:
    IpPublicFamilyStatus[];
  results: IpGeolocationResult[];
  savingResultId: string | null;
  selectedResult:
    IpGeolocationResult | null;
  versionFilter:
    IpGeolocationVersionFilter;

  cancel(): void;
  clear(): void;
  close(): void;
  focusResult(resultId: string): void;
  lookup(): void;
  lookupIp(ip: string): void;
  lookupPublicIp(): void;
  openPanel(): void;
  removeHistory(historyId: string): void;
  removeTransientResult(
    resultId: string,
  ): void;
  reportMapError(error: unknown): void;
  saveResult(resultId: string): void;
  setColor(
    resultId: string,
    color: MapMarkerColor,
  ): void;
  setConnectResults(enabled: boolean): void;
  setInput(value: string): void;
  setVersionFilter(
    filter: IpGeolocationVersionFilter,
  ): void;
};

const MAX_HISTORY_ITEMS = 20;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nullableString(
  value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return undefined;
  }

  return value.trim();
}

function isErrorCode(
  value: unknown,
): value is IpGeolocationErrorCode {
  return (
    value === 'cancelled' ||
    value === 'invalid-ip' ||
    value === 'offline' ||
    value === 'rate-limited' ||
    value === 'timeout' ||
    value === 'unavailable' ||
    value === 'invalid-response'
  );
}

function parseProviderResult(
  value: unknown,
): IpGeolocationProviderResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const validation =
    typeof value.ip === 'string'
      ? validatePublicIpAddress(value.ip)
      : null;
  const latitude = value.latitude;
  const longitude = value.longitude;
  const city = nullableString(value.city);
  const region = nullableString(
    value.region,
  );
  const country = nullableString(
    value.country,
  );
  const countryCode = nullableString(
    value.countryCode,
  );
  const postalCode = nullableString(
    value.postalCode,
  );
  const timezone = nullableString(
    value.timezone,
  );
  const asn = nullableString(value.asn);
  const organization = nullableString(
    value.organization,
  );
  const currency = nullableString(
    value.currency,
  );

  if (
    !validation ||
    validation.valid === false ||
    value.version !== validation.version ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !hasValidIpGeolocationCoordinates({
      latitude,
      longitude,
    }) ||
    city === undefined ||
    region === undefined ||
    country === undefined ||
    countryCode === undefined ||
    postalCode === undefined ||
    timezone === undefined ||
    asn === undefined ||
    organization === undefined ||
    currency === undefined ||
    value.provider !== 'ipapi.co' ||
    typeof value.consultedAt !==
      'string' ||
    !Number.isFinite(
      Date.parse(value.consultedAt),
    )
  ) {
    return null;
  }

  return {
    ip: validation.ip,
    version: validation.version,
    city,
    region,
    country,
    countryCode,
    latitude,
    longitude,
    postalCode,
    timezone,
    asn,
    organization,
    currency,
    provider: 'ipapi.co',
    consultedAt: value.consultedAt,
  };
}

export function parseLookupResponse(
  value: unknown,
): IpGeolocationLookupResponse | null {
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

  const result = parseProviderResult(
    value.result,
  );

  if (
    typeof value.cached !== 'boolean' ||
    !result
  ) {
    return null;
  }

  return {
    ok: true,
    cached: value.cached,
    result,
  };
}

function parsePublicFamilyResponse(
  value: unknown,
): IpPublicFamilyLookupResponse | null {
  if (
    !isRecord(value) ||
    typeof value.ok !== 'boolean' ||
    (
      value.version !== 'IPv4' &&
      value.version !== 'IPv6'
    )
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
      version: value.version,
      error: {
        code: value.error.code,
        message: value.error.message.trim(),
      },
    };
  }

  const result = parseProviderResult(
    value.result,
  );

  if (
    !result ||
    result.version !== value.version ||
    typeof value.cached !== 'boolean'
  ) {
    return null;
  }

  return {
    ok: true,
    version: value.version,
    cached: value.cached,
    result,
  };
}

export function parsePublicLookupResponse(
  value: unknown,
): IpPublicLookupResponse | null {
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

  if (!Array.isArray(value.families)) {
    return null;
  }

  const families = value.families.map(
    parsePublicFamilyResponse,
  );

  if (
    families.length !== 2 ||
    families.some(
      (family) => family === null,
    ) ||
    new Set(
      families.map(
        (family) => family?.version,
      ),
    ).size !== 2
  ) {
    return null;
  }

  return {
    ok: true,
    families:
      families as IpPublicFamilyLookupResponse[],
  };
}

function messageFromUnknownError(
  unknownError: unknown,
): string {
  return unknownError instanceof Error
    ? unknownError.message
    : 'Não foi possível concluir a operação.';
}

function cancelLookupSafely(
  requestId: string,
): void {
  try {
    const cancellation =
      window.zeroHub?.ipGeolocation
        ?.cancel?.(requestId);

    if (cancellation) {
      void cancellation.catch(
        (unknownError: unknown) => {
          console.error(
            '[IP Intelligence] Falha ao cancelar a consulta IPC.',
            unknownError,
          );
        },
      );
    }
  } catch (unknownError) {
    console.error(
      '[IP Intelligence] Falha síncrona ao cancelar a consulta IPC.',
      unknownError,
    );
  }
}

export function useIpGeolocationIntelligence({
  activeCaseId,
  addActivity,
  persistentResults,
}: UseIpGeolocationIntelligenceOptions):
  IpGeolocationIntelligence {
  const scopeId =
    activeCaseId ?? 'no-case';
  const mountedRef = useRef(true);
  const requestIdRef =
    useRef<string | null>(null);
  const savingRef =
    useRef(new Set<string>());
  const resultsRef =
    useRef<IpGeolocationResult[]>([]);
  const nextColorRef = useRef(0);
  const [busy, setBusy] =
    useState(false);
  const [connectResults, setConnectResults] =
    useScopedWorkspaceState(
      scopeId,
      false,
    );
  const [feedback, setFeedback] =
    useScopedWorkspaceState<
      IpGeolocationFeedback | null
    >(scopeId, null);
  const [history, setHistory] =
    useScopedWorkspaceState<
      IpGeolocationHistoryItem[]
    >(
      scopeId,
      [],
    );
  const [input, setQueryInput] =
    useScopedWorkspaceState(
      scopeId,
      '',
    );
  const [open, setOpen] =
    useState(false);
  const [publicFamilyStatuses,
    setPublicFamilyStatuses] =
    useScopedWorkspaceState<
      IpPublicFamilyStatus[]
    >(scopeId, []);
  const [savingResultId, setSavingResultId] =
    useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] =
    useScopedWorkspaceState<
      string | null
    >(scopeId, null);
  const [transientResults, setTransientResults] =
    useState<IpGeolocationResult[]>([]);
  const [versionFilter, setVersionFilter] =
    useScopedWorkspaceState<
      IpGeolocationVersionFilter
    >(
      scopeId,
      'all',
    );

  const allResults = useMemo(() => {
    const persistentIds = new Set(
      persistentResults.map(
        (result) => result.id,
      ),
    );

    return [
      ...persistentResults,
      ...transientResults.filter(
        (result) =>
          result.caseId ===
            activeCaseId &&
          !persistentIds.has(result.id),
      ),
    ].sort(
      (left, right) =>
        Date.parse(right.consultedAt) -
        Date.parse(left.consultedAt),
    );
  }, [
    activeCaseId,
    persistentResults,
    transientResults,
  ]);
  const results = useMemo(
    () =>
      versionFilter === 'all'
        ? allResults
        : allResults.filter(
          (result) =>
            result.version ===
              versionFilter,
        ),
    [allResults, versionFilter],
  );
  const selectedResult =
    useMemo(
      () =>
        allResults.find(
          (result) =>
            result.id ===
            selectedResultId,
        ) ?? null,
      [allResults, selectedResultId],
    );
  resultsRef.current = allResults;

  const addHistory = useCallback(
    (result: IpGeolocationResult) => {
      setHistory(
        (current) => [
          {
            id: crypto.randomUUID(),
            ip: result.ip,
            resultId: result.id,
            consultedAt:
              result.consultedAt,
            version: result.version,
          },
          ...current,
        ].slice(0, MAX_HISTORY_ITEMS),
      );
    },
    [],
  );

  const executeLookup = useCallback(
    async (
      requestedIp: string | null,
    ): Promise<void> => {
      if (
        busy ||
        requestIdRef.current !== null
      ) {
        return;
      }

      let normalizedIp:
        string | null = null;

      if (requestedIp !== null) {
        const validation =
          validatePublicIpAddress(
            requestedIp,
          );

        if (validation.valid === false) {
          setFeedback({
            message: validation.message,
            tone: 'error',
          });
          return;
        }

        normalizedIp = validation.ip;
      }

      if (navigator.onLine === false) {
        setFeedback({
          message:
            'Sem conexão com a internet. Verifique a rede e tente novamente.',
          tone: 'error',
        });
        return;
      }

      const api =
        window.zeroHub?.ipGeolocation;

      if (
        !api ||
        typeof api.lookup !== 'function'
      ) {
        setFeedback({
          message:
            'A integração de IP Intelligence não está disponível nesta janela.',
          tone: 'error',
        });
        return;
      }

      const requestId =
        crypto.randomUUID();
      requestIdRef.current = requestId;
      setBusy(true);
      setFeedback({
        message:
          requestedIp === null
            ? 'Consultando seu IP público mediante solicitação...'
            : `Consultando ${normalizedIp}...`,
        tone: 'info',
      });

      try {
        const rawResponse =
          await api.lookup({
            requestId,
            ip: normalizedIp,
          });

        if (
          !mountedRef.current ||
          requestIdRef.current !==
            requestId
        ) {
          return;
        }

        const response =
          parseLookupResponse(
            rawResponse as unknown,
          );

        if (!response) {
          console.error(
            '[IP Intelligence] Resposta IPC inválida.',
            rawResponse,
          );
          setFeedback({
            message:
              'A integração retornou uma resposta inválida. Nenhum resultado parcial foi criado.',
            tone: 'error',
          });
          return;
        }

        if (response.ok === false) {
          setFeedback({
            message:
              response.error.message,
            tone:
              response.error.code ===
                'cancelled'
                ? 'info'
                : 'error',
          });
          return;
        }

        const existing =
          resultsRef.current.find(
            (result) =>
              result.ip ===
              response.result.ip,
          );
        const result = existing ??
          createTransientIpResult(
            response.result,
            MAP_MARKER_COLORS[
              nextColorRef.current %
                MAP_MARKER_COLORS.length
            ].id,
            activeCaseId,
          );

        if (!existing) {
          nextColorRef.current += 1;
          setTransientResults(
            (current) => [
              result,
              ...current,
            ],
          );
        }

        setQueryInput(result.ip);
        setSelectedResultId(result.id);
        setOpen(true);
        addHistory(result);
        setFeedback({
          message: response.cached
            ? 'Resultado reutilizado do cache em memória.'
            : 'Consulta concluída. Localização aproximada.',
          tone: 'success',
        });
      } catch (unknownError) {
        console.error(
          '[IP Intelligence] Falha ao invocar a consulta IPC.',
          unknownError,
        );

        if (
          mountedRef.current &&
          requestIdRef.current ===
            requestId
        ) {
          setFeedback({
            message:
              messageFromUnknownError(
                unknownError,
              ),
            tone: 'error',
          });
        }
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
    [
      activeCaseId,
      addHistory,
      busy,
    ],
  );

  const cancel = useCallback(() => {
    const requestId = requestIdRef.current;

    if (!requestId) {
      return;
    }

    requestIdRef.current = null;
    setBusy(false);
    setFeedback({
      message: 'Consulta cancelada.',
      tone: 'info',
    });
    cancelLookupSafely(requestId);
  }, []);

  const clear = useCallback(() => {
    cancel();
    setQueryInput('');
    setFeedback(null);
    setPublicFamilyStatuses([]);
    setSelectedResultId(null);
  }, [cancel]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);

  const focusResult = useCallback(
    (resultId: string) => {
      setSelectedResultId(resultId);
      setOpen(true);
    },
    [],
  );

  const handleUnexpectedLookupError =
    useCallback(
      (unknownError: unknown) => {
        console.error(
          '[IP Intelligence] Falha inesperada no callback de consulta.',
          unknownError,
        );

        if (mountedRef.current) {
          requestIdRef.current = null;
          setBusy(false);
          setFeedback({
            message:
              messageFromUnknownError(
                unknownError,
              ),
            tone: 'error',
          });
        }
      },
      [],
    );

  const lookup = useCallback(() => {
    void executeLookup(input).catch(
      handleUnexpectedLookupError,
    );
  }, [
    executeLookup,
    handleUnexpectedLookupError,
    input,
  ]);

  const executePublicLookup = useCallback(
    async (): Promise<void> => {
      if (
        busy ||
        requestIdRef.current !== null
      ) {
        return;
      }

      if (navigator.onLine === false) {
        setFeedback({
          message:
            'Sem conexão com a internet. Verifique a rede e tente novamente.',
          tone: 'error',
        });
        return;
      }

      const api =
        window.zeroHub?.ipGeolocation;

      if (
        !api ||
        typeof api.lookupPublic !==
          'function'
      ) {
        setFeedback({
          message:
            'A descoberta de IPv4 e IPv6 não está disponível nesta janela.',
          tone: 'error',
        });
        return;
      }

      const requestId =
        crypto.randomUUID();
      requestIdRef.current = requestId;
      setBusy(true);
      setPublicFamilyStatuses([]);
      setFeedback({
        message:
          'Descobrindo IPv4 e IPv6 públicos separadamente...',
        tone: 'info',
      });

      try {
        const rawResponse =
          await api.lookupPublic(
            requestId,
          );

        if (
          !mountedRef.current ||
          requestIdRef.current !==
            requestId
        ) {
          return;
        }

        const response =
          parsePublicLookupResponse(
            rawResponse as unknown,
          );

        if (!response) {
          console.error(
            '[IP Intelligence] Resposta IPC dual-stack inválida.',
            rawResponse,
          );
          setFeedback({
            message:
              'A integração retornou uma resposta dual-stack inválida.',
            tone: 'error',
          });
          return;
        }

        if (response.ok === false) {
          setFeedback({
            message: response.error.message,
            tone:
              response.error.code ===
                'cancelled'
                ? 'info'
                : 'error',
          });
          return;
        }

        const statuses:
          IpPublicFamilyStatus[] =
          response.families.map(
            (family):
              IpPublicFamilyStatus => {
              if (family.ok === true) {
                return {
                  version:
                    family.version,
                  available: true,
                  errorCode: null,
                  message:
                    `${family.version} disponível`,
                };
              }

              return {
                version: family.version,
                available: false,
                errorCode:
                  family.error.code,
                message:
                  family.error.message,
              };
            },
          );
        const successfulFamilies =
          response.families.filter(
            (family): family is Extract<
              IpPublicFamilyLookupResponse,
              { ok: true }
            > => family.ok,
          );
        const createdResults:
          IpGeolocationResult[] = [];

        for (
          const family of
          successfulFamilies
        ) {
          const existing = [
            ...resultsRef.current,
            ...createdResults,
          ].find(
            (result) =>
              result.ip ===
                family.result.ip,
          );
          const result = existing ??
            createTransientIpResult(
              family.result,
              MAP_MARKER_COLORS[
                nextColorRef.current %
                  MAP_MARKER_COLORS.length
              ].id,
              activeCaseId,
            );

          if (!existing) {
            nextColorRef.current += 1;
            createdResults.push(result);
          }

          addHistory(result);
        }

        if (createdResults.length > 0) {
          setTransientResults(
            (current) => [
              ...createdResults,
              ...current,
            ],
          );
        }

        setPublicFamilyStatuses(statuses);
        setOpen(true);
        setVersionFilter('all');

        const firstResult =
          successfulFamilies[0]
            ? [
              ...resultsRef.current,
              ...createdResults,
            ].find(
              (result) =>
                result.ip ===
                  successfulFamilies[0]
                    .result.ip,
            ) ?? null
            : null;

        if (firstResult) {
          setQueryInput(firstResult.ip);
          setSelectedResultId(
            firstResult.id,
          );
        }

        const unavailable = statuses
          .filter(
            (status) =>
              !status.available,
          )
          .map(
            (status) => status.message,
          );

        setFeedback({
          message:
            successfulFamilies.length > 0
              ? unavailable.length > 0
                ? `Consulta parcial concluída. ${unavailable.join(' ')}`
                : 'IPv4 e IPv6 públicos consultados com sucesso.'
              : unavailable.join(' ') ||
                'Nenhuma família pública pôde ser consultada.',
          tone:
            successfulFamilies.length > 0
              ? 'success'
              : 'error',
        });
      } catch (unknownError) {
        console.error(
          '[IP Intelligence] Falha ao invocar a consulta dual-stack.',
          unknownError,
        );

        if (
          mountedRef.current &&
          requestIdRef.current ===
            requestId
        ) {
          setFeedback({
            message:
              messageFromUnknownError(
                unknownError,
              ),
            tone: 'error',
          });
        }
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
    [
      activeCaseId,
      addHistory,
      busy,
    ],
  );

  const lookupPublicIp = useCallback(() => {
    void executePublicLookup().catch(
      handleUnexpectedLookupError,
    );
  }, [
    executePublicLookup,
    handleUnexpectedLookupError,
  ]);

  const removeHistory = useCallback(
    (historyId: string) => {
      setHistory(
        (current) =>
          current.filter(
            (item) =>
              item.id !== historyId,
          ),
      );
    },
    [],
  );

  const removeTransientResult =
    useCallback(
      (resultId: string) => {
        setTransientResults(
          (current) =>
            current.filter(
              (result) =>
                result.id !== resultId,
            ),
        );
        setSelectedResultId(
          (current) =>
            current === resultId
              ? null
              : current,
        );
      },
      [],
    );

  const reportMapError = useCallback(
    (unknownError: unknown) => {
      console.error(
        '[IP Intelligence] Falha ao renderizar a camada no mapa.',
        unknownError,
      );

      if (mountedRef.current) {
        setFeedback({
          message:
            'O resultado foi recebido, mas não pôde ser exibido no mapa.',
          tone: 'error',
        });
      }
    },
    [],
  );

  const saveResult = useCallback(
    async (resultId: string) => {
      const result = resultsRef.current.find(
        (item) => item.id === resultId,
      );

      if (!result || result.saved) {
        return;
      }

      if (!activeCaseId) {
        setFeedback({
          message:
            'Selecione um perfil ativo antes de salvar o resultado.',
          tone: 'error',
        });
        return;
      }

      if (savingRef.current.has(resultId)) {
        return;
      }

      savingRef.current.add(resultId);
      setSavingResultId(resultId);
      setFeedback({
        message:
          'Salvando resultado no perfil ativo...',
        tone: 'info',
      });

      try {
        await addActivity(
          createIpGeolocationSavedActivity(
            activeCaseId,
            result,
          ),
        );

        if (mountedRef.current) {
          setFeedback({
            message:
              'Resultado salvo na timeline do perfil.',
            tone: 'success',
          });
        }
      } catch (unknownError) {
        if (mountedRef.current) {
          setFeedback({
            message:
              messageFromUnknownError(
                unknownError,
              ),
            tone: 'error',
          });
        }
      } finally {
        savingRef.current.delete(resultId);

        if (mountedRef.current) {
          setSavingResultId(null);
        }
      }
    },
    [activeCaseId, addActivity],
  );

  const setColor = useCallback(
    (
      resultId: string,
      color: MapMarkerColor,
    ) => {
      setTransientResults(
        (current) =>
          current.map(
            (result) =>
              result.id === resultId &&
              !result.saved
                ? {
                  ...result,
                  color,
                }
                : result,
          ),
      );
    },
    [],
  );

  const setInput = useCallback(
    (value: string) => {
      setQueryInput(value);
      setFeedback(null);
    },
    [],
  );

  useEffect(() => {
    if (
      selectedResultId &&
      !selectedResult
    ) {
      setSelectedResultId(null);
    }
  }, [selectedResult, selectedResultId]);

  useEffect(() => {
    if (
      selectedResult &&
      !results.some(
        (result) =>
          result.id ===
            selectedResult.id,
      )
    ) {
      setSelectedResultId(
        results[0]?.id ?? null,
      );
    }
  }, [results, selectedResult]);

  useEffect(() => {
    if (results.length < 2) {
      setConnectResults(false);
    }
  }, [results.length]);

  useEffect(() => {
    const requestId =
      requestIdRef.current;

    if (!requestId) {
      return;
    }

    requestIdRef.current = null;
    setBusy(false);
    cancelLookupSafely(requestId);
  }, [scopeId]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const requestId =
        requestIdRef.current;

      if (requestId) {
        cancelLookupSafely(requestId);
      }
    };
  }, []);

  return {
    allResults,
    busy,
    connectResults,
    feedback,
    history,
    input,
    open,
    publicFamilyStatuses,
    results,
    savingResultId,
    selectedResult,
    versionFilter,
    cancel,
    clear,
    close,
    focusResult,
    lookup,
    lookupIp: (ip) => {
      setQueryInput(ip);
      setOpen(true);
      void executeLookup(ip).catch(
        handleUnexpectedLookupError,
      );
    },
    lookupPublicIp,
    openPanel,
    removeHistory,
    removeTransientResult,
    reportMapError,
    saveResult: (resultId) => {
      void saveResult(resultId);
    },
    setColor,
    setConnectResults,
    setInput,
    setVersionFilter,
  };
}
