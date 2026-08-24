import {
  net,
} from 'electron';

import {
  validatePublicIpAddress,
} from '../../shared/ip-geolocation/ip-address.validation';
import {
  publicIpDiscoveryService,
} from './public-ip-discovery.service';

import type {
  PublicIpDiscoveryResponse,
} from './public-ip-discovery.service';

import type {
  IpAddressVersion,
  IpGeolocationErrorCode,
  IpGeolocationLookupRequest,
  IpGeolocationLookupResponse,
  IpGeolocationProviderResult,
  IpPublicFamilyLookupResponse,
  IpPublicLookupRequest,
  IpPublicLookupResponse,
} from '../../shared/ip-geolocation/ip-geolocation.types';

type CacheEntry = {
  expiresAt: number;
  result: IpGeolocationProviderResult;
};

type ProviderFailure = {
  code: IpGeolocationErrorCode;
  message: string;
};

export type IpGeolocationProvider = {
  readonly id: 'ipapi.co';

  lookup(
    ip: string | null,
    signal: AbortSignal,
  ): Promise<IpGeolocationProviderResult>;
};

export type PublicIpDiscoveryProvider = {
  discover(
    version: IpAddressVersion,
    signal: AbortSignal,
  ): Promise<PublicIpDiscoveryResponse>;
};

const IPAPI_BASE_URL =
  'https://ipapi.co';
const LOOKUP_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESPONSE_LENGTH = 64 * 1024;
const MAX_CACHE_ENTRIES = 256;
const PUBLIC_IP_CACHE_KEY =
  '__public-ip__';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function optionalString(
  value: unknown,
): string | null {
  return typeof value === 'string' &&
    value.trim()
    ? value.trim()
    : null;
}

function providerFailure(
  code: IpGeolocationErrorCode,
  message: string,
): ProviderFailure {
  return {
    code,
    message,
  };
}

function isProviderFailure(
  value: unknown,
): value is ProviderFailure {
  return (
    isRecord(value) &&
    (
      value.code === 'cancelled' ||
      value.code === 'invalid-ip' ||
      value.code === 'offline' ||
      value.code === 'rate-limited' ||
      value.code === 'timeout' ||
      value.code === 'unavailable' ||
      value.code === 'invalid-response'
    ) &&
    typeof value.message === 'string'
  );
}

function buildProviderUrl(
  ip: string | null,
): URL {
  const path = ip
    ? `/${ip}/json/`
    : '/json/';
  const url = new URL(
    path,
    IPAPI_BASE_URL,
  );

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'ipapi.co' ||
    url.port
  ) {
    throw providerFailure(
      'unavailable',
      'O provider de geolocalização possui uma configuração inválida.',
    );
  }

  return url;
}

function parseProviderResponse(
  value: unknown,
): IpGeolocationProviderResult {
  if (!isRecord(value)) {
    throw providerFailure(
      'invalid-response',
      'O provider retornou uma resposta inválida.',
    );
  }

  if (value.error === true) {
    const reason = optionalString(
      value.reason,
    );
    const rateLimited =
      reason?.toLowerCase() ===
        'ratelimited';

    throw providerFailure(
      rateLimited
        ? 'rate-limited'
        : 'invalid-response',
      rateLimited
        ? 'O limite de consultas do provider foi atingido. Tente novamente mais tarde.'
        : optionalString(value.message) ??
          'O provider não conseguiu localizar este IP.',
    );
  }

  const ip = optionalString(value.ip);
  const validation = ip
    ? validatePublicIpAddress(ip)
    : null;
  const latitude = value.latitude;
  const longitude = value.longitude;

  if (
    !validation ||
    !validation.valid ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw providerFailure(
      'invalid-response',
      'O provider retornou dados geográficos inválidos.',
    );
  }

  const version: IpAddressVersion =
    validation.version;

  return {
    ip: validation.ip,
    version,
    city: optionalString(value.city),
    region: optionalString(value.region),
    country:
      optionalString(value.country_name),
    countryCode:
      optionalString(
        value.country_code ??
          value.country,
      ),
    latitude,
    longitude,
    postalCode:
      optionalString(value.postal),
    timezone:
      optionalString(value.timezone),
    asn: optionalString(value.asn),
    organization:
      optionalString(value.org),
    currency:
      optionalString(value.currency),
    provider: 'ipapi.co',
    consultedAt:
      new Date().toISOString(),
  };
}

class IpapiProvider implements
  IpGeolocationProvider {
  readonly id = 'ipapi.co' as const;

  async lookup(
    ip: string | null,
    signal: AbortSignal,
  ): Promise<IpGeolocationProviderResult> {
    const response = await net.fetch(
      buildProviderUrl(ip).toString(),
      {
        method: 'GET',
        redirect: 'error',
        signal,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'ZeroHub/0.1.0 IP Intelligence',
        },
      },
    );

    if (response.status === 429) {
      throw providerFailure(
        'rate-limited',
        'O limite de consultas do provider foi atingido. Tente novamente mais tarde.',
      );
    }

    if (
      response.status >= 500 ||
      response.status === 408
    ) {
      throw providerFailure(
        'unavailable',
        'O provider de geolocalização está temporariamente indisponível.',
      );
    }

    if (!response.ok) {
      throw providerFailure(
        'invalid-response',
        `O provider rejeitou a consulta com HTTP ${response.status}.`,
      );
    }

    const contentLength = Number(
      response.headers.get(
        'content-length',
      ),
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_RESPONSE_LENGTH
    ) {
      throw providerFailure(
        'invalid-response',
        'A resposta do provider excede o limite permitido.',
      );
    }

    const text = await response.text();

    if (text.length > MAX_RESPONSE_LENGTH) {
      throw providerFailure(
        'invalid-response',
        'A resposta do provider excede o limite permitido.',
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw providerFailure(
        'invalid-response',
        'O provider retornou JSON inválido.',
      );
    }

    const result =
      parseProviderResponse(parsed);

    if (
      ip !== null &&
      result.ip !== ip
    ) {
      throw providerFailure(
        'invalid-response',
        'O provider retornou dados de um IP diferente do solicitado.',
      );
    }

    return result;
  }

}

export class IpGeolocationService {
  private readonly cache =
    new Map<string, CacheEntry>();

  private readonly controllers =
    new Map<string, AbortController>();

  constructor(
    private readonly provider:
      IpGeolocationProvider,
    private readonly publicIpDiscovery:
      PublicIpDiscoveryProvider =
        publicIpDiscoveryService,
    private readonly isOnline:
      () => boolean = () =>
        net.isOnline(),
    private readonly lookupTimeoutMs =
      LOOKUP_TIMEOUT_MS,
  ) {}

  private pruneCache(): void {
    const now = Date.now();

    for (
      const [key, entry] of this.cache
    ) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }

    while (
      this.cache.size >
      MAX_CACHE_ENTRIES - 2
    ) {
      const oldestKey =
        this.cache.keys().next()
          .value as string | undefined;

      if (!oldestKey) {
        break;
      }

      this.cache.delete(oldestKey);
    }
  }

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

  async lookup(
    request: IpGeolocationLookupRequest,
  ): Promise<IpGeolocationLookupResponse> {
    this.pruneCache();
    const cacheKey =
      request.ip ?? PUBLIC_IP_CACHE_KEY;
    const cached = this.cache.get(cacheKey);

    if (
      cached &&
      cached.expiresAt > Date.now()
    ) {
      return {
        ok: true,
        cached: true,
        result: cached.result,
      };
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    if (!this.isOnline()) {
      return {
        ok: false,
        error: providerFailure(
          'offline',
          'Sem conexão com a internet. Verifique a rede e tente novamente.',
        ),
      };
    }

    this.cancel(request.requestId);
    const controller =
      new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.lookupTimeoutMs);
    this.controllers.set(
      request.requestId,
      controller,
    );

    try {
      const result =
        await this.provider.lookup(
          request.ip,
          controller.signal,
        );
      const entry = {
        expiresAt:
          Date.now() + CACHE_TTL_MS,
        result,
      };

      this.cache.set(cacheKey, entry);
      this.cache.set(result.ip, entry);

      return {
        ok: true,
        cached: false,
        result,
      };
    } catch (unknownError) {
      if (controller.signal.aborted) {
        return {
          ok: false,
          error: providerFailure(
            timedOut
              ? 'timeout'
              : 'cancelled',
            timedOut
              ? 'A consulta excedeu o tempo limite.'
              : 'Consulta cancelada.',
          ),
        };
      }

      if (isProviderFailure(unknownError)) {
        return {
          ok: false,
          error: unknownError,
        };
      }

      return {
        ok: false,
        error: providerFailure(
          this.isOnline()
            ? 'unavailable'
            : 'offline',
          this.isOnline()
            ? 'Não foi possível acessar o provider de geolocalização.'
            : 'Sem conexão com a internet. Verifique a rede e tente novamente.',
        ),
      };
    } finally {
      clearTimeout(timeout);

      if (
        this.controllers.get(
          request.requestId,
        ) === controller
      ) {
        this.controllers.delete(
          request.requestId,
        );
      }
    }
  }

  private async lookupPublicFamily(
    version: IpAddressVersion,
    parentSignal: AbortSignal,
  ): Promise<IpPublicFamilyLookupResponse> {
    const controller =
      new AbortController();
    let timedOut = false;
    const abortFromParent = () => {
      controller.abort();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.lookupTimeoutMs);

    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener(
        'abort',
        abortFromParent,
        { once: true },
      );
    }

    try {
      const discovery =
        await this.publicIpDiscovery
          .discover(
            version,
            controller.signal,
          );

      if (discovery.ok === false) {
        return {
          ok: false,
          version,
          error: discovery.error,
        };
      }

      const cached = this.cache.get(
        discovery.ip,
      );

      if (
        cached &&
        cached.expiresAt > Date.now()
      ) {
        return {
          ok: true,
          version,
          cached: true,
          result: cached.result,
        };
      }

      if (cached) {
        this.cache.delete(discovery.ip);
      }

      const result =
        await this.provider.lookup(
          discovery.ip,
          controller.signal,
        );
      const entry = {
        expiresAt:
          Date.now() + CACHE_TTL_MS,
        result,
      };

      this.cache.set(discovery.ip, entry);

      return {
        ok: true,
        version,
        cached: false,
        result,
      };
    } catch (unknownError) {
      if (controller.signal.aborted) {
        return {
          ok: false,
          version,
          error: providerFailure(
            timedOut
              ? 'timeout'
              : 'cancelled',
            timedOut
              ? `${version} indisponível: a consulta excedeu o tempo limite.`
              : 'Consulta cancelada.',
          ),
        };
      }

      if (isProviderFailure(unknownError)) {
        return {
          ok: false,
          version,
          error: unknownError,
        };
      }

      return {
        ok: false,
        version,
        error: providerFailure(
          this.isOnline()
            ? 'unavailable'
            : 'offline',
          this.isOnline()
            ? `${version} indisponível: não foi possível concluir a consulta.`
            : `${version} indisponível: sem conexão com a internet.`,
        ),
      };
    } finally {
      clearTimeout(timeout);
      parentSignal.removeEventListener(
        'abort',
        abortFromParent,
      );
    }
  }

  async lookupPublic(
    request: IpPublicLookupRequest,
  ): Promise<IpPublicLookupResponse> {
    this.pruneCache();

    if (!this.isOnline()) {
      return {
        ok: false,
        error: providerFailure(
          'offline',
          'Sem conexão com a internet. Verifique a rede e tente novamente.',
        ),
      };
    }

    this.cancel(request.requestId);
    const controller =
      new AbortController();
    this.controllers.set(
      request.requestId,
      controller,
    );

    try {
      const families = await Promise.all([
        this.lookupPublicFamily(
          'IPv4',
          controller.signal,
        ),
        this.lookupPublicFamily(
          'IPv6',
          controller.signal,
        ),
      ]);

      if (controller.signal.aborted) {
        return {
          ok: false,
          error: providerFailure(
            'cancelled',
            'Consulta cancelada.',
          ),
        };
      }

      return {
        ok: true,
        families,
      };
    } finally {
      if (
        this.controllers.get(
          request.requestId,
        ) === controller
      ) {
        this.controllers.delete(
          request.requestId,
        );
      }
    }
  }
}

export const ipGeolocationService =
  new IpGeolocationService(
    new IpapiProvider(),
  );
