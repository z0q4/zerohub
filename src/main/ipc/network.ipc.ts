import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  DnsLookupRequest,
  DnsLookupResult,
  DnsRecordType,
} from '../../shared/network/dns.types';

import type {
  PingRequest,
  PingResult,
} from '../../shared/network/ping.types';

const DNS_RECORD_TYPES:
  readonly DnsRecordType[] = [
    'A',
    'AAAA',
    'MX',
    'TXT',
    'NS',
    'CNAME',
  ];

function isDnsRecordType(
  value: unknown,
): value is DnsRecordType {
  return (
    typeof value === 'string' &&
    DNS_RECORD_TYPES.includes(
      value as DnsRecordType,
    )
  );
}

function parseDnsRequest(
  value: unknown,
): DnsLookupRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação DNS é inválida.',
    );
  }

  const request =
    value as Partial<DnsLookupRequest>;

  if (
    typeof request.domain !==
    'string'
  ) {
    throw new TypeError(
      'O domínio precisa ser um texto.',
    );
  }

  if (
    !isDnsRecordType(
      request.recordType,
    )
  ) {
    throw new TypeError(
      'O tipo de registro DNS é inválido.',
    );
  }

  return {
    domain:
      request.domain,

    recordType:
      request.recordType,
  };
}

function parsePingRequest(
  value: unknown,
): PingRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação de Ping é inválida.',
    );
  }

  const request =
    value as Partial<PingRequest>;

  if (
    typeof request.target !==
    'string'
  ) {
    throw new TypeError(
      'O alvo precisa ser um texto.',
    );
  }

  if (
    typeof request.count !==
    'number' ||
    !Number.isInteger(
      request.count,
    )
  ) {
    throw new TypeError(
      'A quantidade de pacotes é inválida.',
    );
  }

  if (
    typeof request.timeoutMs !==
    'number' ||
    !Number.isInteger(
      request.timeoutMs,
    )
  ) {
    throw new TypeError(
      'O timeout informado é inválido.',
    );
  }

  return {
    target:
      request.target,

    count:
      request.count,

    timeoutMs:
      request.timeoutMs,
  };
}

export function registerNetworkIpcHandlers():
  void {
  ipcMain.handle(
    'network:dns:lookup',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseDnsRequest(
          rawRequest,
        );

      return pythonService.invoke<DnsLookupResult>(
        'network.dns_lookup',
        {
          domain:
            request.domain,

          recordType:
            request.recordType,
        },
        20_000,
      );
    },
  );

  ipcMain.handle(
    'network:ping',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parsePingRequest(
          rawRequest,
        );

      const operationTimeout =
        Math.min(
          70_000,

          request.count *
            request.timeoutMs +
            10_000,
        );

      return pythonService.invoke<PingResult>(
        'network.ping',
        {
          target:
            request.target,

          count:
            request.count,

          timeoutMs:
            request.timeoutMs,
        },
        operationTimeout,
      );
    },
  );
}
