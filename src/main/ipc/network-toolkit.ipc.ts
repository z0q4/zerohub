import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  DnsExploreResult,
  NetworkInterfacesResult,
  NetworkRoutesResult,
  PortCheckResult,
  SubnetResult,
  TracerouteResult,
} from '../../shared/network-toolkit/network-toolkit.types';

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

function requireInteger(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value)
  ) {
    throw new TypeError(
      `${field} precisa ser um inteiro.`,
    );
  }

  return value;
}

export function registerNetworkToolkitIpcHandlers():
  void {
  ipcMain.handle(
    'network-toolkit:port-check',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          host?: unknown;
          port?: unknown;
          timeoutMs?: unknown;
        };

      return pythonService.invoke<PortCheckResult>(
        'network_toolkit.port_check',
        {
          host:
            requireString(
              request.host,
              'O host',
            ),

          port:
            requireInteger(
              request.port,
              'A porta',
            ),

          timeoutMs:
            requireInteger(
              request.timeoutMs,
              'O timeout',
            ),
        },
        60_000,
      );
    },
  );

  ipcMain.handle(
    'network-toolkit:traceroute',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          host?: unknown;
          maxHops?: unknown;
        };

      return pythonService.invoke<TracerouteResult>(
        'network_toolkit.traceroute',
        {
          host:
            requireString(
              request.host,
              'O host',
            ),

          maxHops:
            requireInteger(
              request.maxHops,
              'O limite de saltos',
            ),
        },
        120_000,
      );
    },
  );

  ipcMain.handle(
    'network-toolkit:subnet',
    async (
      _event,
      rawNetwork: unknown,
    ) =>
      pythonService.invoke<SubnetResult>(
        'network_toolkit.subnet',
        {
          network:
            requireString(
              rawNetwork,
              'O CIDR',
            ),
        },
      ),
  );

  ipcMain.handle(
    'network-toolkit:dns',
    async (
      _event,
      rawDomain: unknown,
      rawRecordType: unknown,
    ) =>
      pythonService.invoke<DnsExploreResult>(
        'network_toolkit.dns',
        {
          domain:
            requireString(
              rawDomain,
              'O domínio',
            ),

          recordType:
            requireString(
              rawRecordType,
              'O tipo DNS',
            ),
        },
        60_000,
      ),
  );

  ipcMain.handle(
    'network-toolkit:interfaces',
    async () =>
      pythonService.invoke<NetworkInterfacesResult>(
        'network_toolkit.interfaces',
        {},
      ),
  );

  ipcMain.handle(
    'network-toolkit:routes',
    async () =>
      pythonService.invoke<NetworkRoutesResult>(
        'network_toolkit.routes',
        {},
      ),
  );
}
