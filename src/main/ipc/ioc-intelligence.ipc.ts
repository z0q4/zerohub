import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import {
  clearIocKeys,
  getIocKeys,
  getIocKeyStatus,
  saveIocKeys,
} from '../services/ioc-intelligence-secrets.service';

import type {
  IocIntelligenceResult,
  IocKeyInput,
  IocProviderName,
  IocQueryRequest,
} from '../../shared/ioc-intelligence/ioc-intelligence.types';

const PROVIDERS:
  IocProviderName[] = [
    'urlhaus',
    'malwareBazaar',
    'abuseIpDb',
    'otx',
  ];

function requireString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== 'string'
  ) {
    throw new TypeError(
      `${field} precisa ser um texto.`,
    );
  }

  return value;
}

function parseKeys(
  rawValue: unknown,
): IocKeyInput {
  const value =
    rawValue as Partial<IocKeyInput>;

  return {
    abuseCh:
      requireString(
        value.abuseCh,
        'A chave da abuse.ch',
      ),

    abuseIpDb:
      requireString(
        value.abuseIpDb,
        'A chave do AbuseIPDB',
      ),

    otx:
      requireString(
        value.otx,
        'A chave do OTX',
      ),
  };
}

function parseQuery(
  rawValue: unknown,
): IocQueryRequest {
  const value =
    rawValue as Partial<IocQueryRequest>;

  if (
    typeof value.services !==
    'object' ||
    value.services === null
  ) {
    throw new TypeError(
      'Os provedores precisam ser informados.',
    );
  }

  const services =
    {} as Record<
      IocProviderName,
      boolean
    >;

  for (
    const provider
    of PROVIDERS
  ) {
    const enabled =
      value.services[provider];

    if (
      typeof enabled !==
      'boolean'
    ) {
      throw new TypeError(
        `O provedor ${provider} precisa ser booleano.`,
      );
    }

    services[provider] =
      enabled;
  }

  return {
    indicators:
      requireString(
        value.indicators,
        'Os indicadores',
      ),

    services,
  };
}

export function registerIocIntelligenceIpcHandlers():
  void {
  ipcMain.handle(
    'ioc-intelligence:key-status',
    async () =>
      getIocKeyStatus(),
  );

  ipcMain.handle(
    'ioc-intelligence:save-keys',
    async (
      _event,
      rawKeys: unknown,
    ) =>
      saveIocKeys(
        parseKeys(rawKeys),
      ),
  );

  ipcMain.handle(
    'ioc-intelligence:clear-keys',
    async () =>
      clearIocKeys(),
  );

  ipcMain.handle(
    'ioc-intelligence:query',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseQuery(rawRequest);

      const keys =
        await getIocKeys();

      return pythonService.invoke<IocIntelligenceResult>(
        'ioc_intelligence.query',
        {
          ...request,
          keys,
        },
        240_000,
      );
    },
  );
}
