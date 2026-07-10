import {
  clipboard,
  contextBridge,
  ipcRenderer,
} from 'electron';

import type {
  HashAlgorithm,
  HashFileResult,
  HashTextRequest,
} from './shared/hash/hash.types';

import type {
  DnsLookupRequest,
  DnsLookupResult,
} from './shared/network/dns.types';

import type {
  PingRequest,
  PingResult,
} from './shared/network/ping.types';

import type {
  RdapDomainRequest,
  RdapDomainResult,
} from './shared/osint/rdap.types';

import type {
  AppSettings,
} from './shared/settings/settings.types';

const zeroHubAPI = {
  system: {
    getRuntimeInfo: () => ({
      platform:
        process.platform,

      electronVersion:
        process.versions.electron,

      nodeVersion:
        process.versions.node,

      chromiumVersion:
        process.versions.chrome,
    }),
  },

  clipboard: {
    writeText: (
      text: string,
    ): void => {
      if (
        typeof text !==
        'string'
      ) {
        throw new TypeError(
          'O conteúdo do clipboard precisa ser uma string.',
        );
      }

      clipboard.writeText(text);
    },
  },

  hash: {
    text: (
      request:
        HashTextRequest,
    ): Promise<string> =>
      ipcRenderer.invoke(
        'hash:text',
        request,
      ),

    selectFile: (
      algorithm:
        HashAlgorithm,
    ): Promise<
      HashFileResult | null
    > =>
      ipcRenderer.invoke(
        'hash:file:select',
        algorithm,
      ),
  },

  network: {
    dnsLookup: (
      request:
        DnsLookupRequest,
    ): Promise<DnsLookupResult> =>
      ipcRenderer.invoke(
        'network:dns:lookup',
        request,
      ),

    ping: (
      request:
        PingRequest,
    ): Promise<PingResult> =>
      ipcRenderer.invoke(
        'network:ping',
        request,
      ),
  },

  osint: {
    rdapDomain: (
      request:
        RdapDomainRequest,
    ): Promise<RdapDomainResult> =>
      ipcRenderer.invoke(
        'osint:rdap:domain',
        request,
      ),
  },

  settings: {
    get: ():
      Promise<AppSettings> =>
      ipcRenderer.invoke(
        'settings:get',
      ),

    save: (
      settings:
        AppSettings,
    ): Promise<AppSettings> =>
      ipcRenderer.invoke(
        'settings:save',
        settings,
      ),
  },
};

contextBridge.exposeInMainWorld(
  'zeroHub',
  zeroHubAPI,
);
