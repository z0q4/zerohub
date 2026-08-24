import {
  net,
} from 'electron';

import {
  validatePublicIpAddress,
} from '../../shared/ip-geolocation/ip-address.validation';

import type {
  IpAddressVersion,
  IpGeolocationErrorCode,
} from '../../shared/ip-geolocation/ip-geolocation.types';

export type PublicIpDiscoveryResponse =
  | {
    ok: true;
    ip: string;
  }
  | {
    ok: false;
    error: {
      code: IpGeolocationErrorCode;
      message: string;
    };
  };

const DISCOVERY_ENDPOINTS:
  Record<IpAddressVersion, string> = {
    IPv4:
      'https://api.ipify.org?format=json',
    IPv6:
      'https://api6.ipify.org?format=json',
  };
const MAX_RESPONSE_LENGTH = 1024;

export type PublicIpDiscoveryTransport = {
  fetch: typeof net.fetch;
  isOnline: () => boolean;
};

function failure(
  code: IpGeolocationErrorCode,
  message: string,
): PublicIpDiscoveryResponse {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

export class PublicIpDiscoveryService {
  constructor(
    private readonly transport:
      PublicIpDiscoveryTransport = {
        fetch: (...args) =>
          net.fetch(...args),
        isOnline: () => net.isOnline(),
      },
  ) {}

  async discover(
    version: IpAddressVersion,
    signal: AbortSignal,
  ): Promise<PublicIpDiscoveryResponse> {
    try {
      const response = await this.transport.fetch(
        DISCOVERY_ENDPOINTS[version],
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
        return failure(
          'rate-limited',
          `${version} indisponível: o serviço de descoberta limitou as consultas.`,
        );
      }

      if (!response.ok) {
        return failure(
          'unavailable',
          `${version} indisponível: o serviço de descoberta respondeu com HTTP ${response.status}.`,
        );
      }

      const text = await response.text();

      if (
        text.length > MAX_RESPONSE_LENGTH
      ) {
        return failure(
          'invalid-response',
          `${version} indisponível: resposta de descoberta acima do limite permitido.`,
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return failure(
          'invalid-response',
          `${version} indisponível: o serviço de descoberta retornou JSON inválido.`,
        );
      }

      const candidate =
        typeof parsed === 'object' &&
        parsed !== null &&
        'ip' in parsed &&
        typeof parsed.ip === 'string'
          ? parsed.ip
          : '';
      const validation =
        validatePublicIpAddress(candidate);

      if (
        validation.valid === false ||
        validation.version !== version
      ) {
        return failure(
          'invalid-response',
          `${version} indisponível: o serviço de descoberta retornou uma família inválida.`,
        );
      }

      return {
        ok: true,
        ip: validation.ip,
      };
    } catch (unknownError) {
      if (signal.aborted) {
        throw unknownError;
      }

      const online =
        this.transport.isOnline();

      return failure(
        online
          ? 'unavailable'
          : 'offline',
        online
          ? `${version} indisponível nesta conexão.`
          : `${version} indisponível: sem conexão com a internet.`,
      );
    }
  }
}

export const publicIpDiscoveryService =
  new PublicIpDiscoveryService();
