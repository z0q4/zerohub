import {
  clipboard,
  contextBridge,
  ipcRenderer,
} from 'electron';

import type {
  EncodingTransformRequest,
} from './shared/encoding/encoding.types';

import type {
  FileAnalysisResult,
} from './shared/file-analysis/file-analysis.types';

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

import type {
  VirusTotalSecretStatus,
  VirusTotalTargetResult,
} from './shared/threat-intelligence/threat-intelligence.types';

import type {
  FileCrackRequest,
  FileCrackResult,
} from './shared/file-cracker/file-cracker.types';

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

  encoding: {
    transform: (
      request:
        EncodingTransformRequest,
    ): Promise<string> =>
      ipcRenderer.invoke(
        'encoding:transform',
        request,
      ),
  },

  fileAnalysis: {
    inspectFile: ():
      Promise<FileAnalysisResult | null> =>
      ipcRenderer.invoke(
        'file-analysis:inspect-file',
      ),
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

  threatIntelligence: {
    getVirusTotalStatus: ():
      Promise<VirusTotalSecretStatus> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:status',
      ),

    saveVirusTotalApiKey: (
      apiKey: string,
    ): Promise<VirusTotalSecretStatus> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:save-key',
        apiKey,
      ),

    removeVirusTotalApiKey: ():
      Promise<VirusTotalSecretStatus> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:remove-key',
      ),

    lookupVirusTotalFile: ():
      Promise<VirusTotalTargetResult | null> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:lookup-file',
      ),

    refreshVirusTotalFile: ():
      Promise<VirusTotalTargetResult> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:refresh-file',
      ),

    uploadVirusTotalFile: ():
      Promise<VirusTotalTargetResult | null> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:upload-file',
      ),

    lookupVirusTotalUrl: (
      url: string,
    ): Promise<VirusTotalTargetResult> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:lookup-url',
        url,
      ),

    scanVirusTotalUrl: (
      url: string,
    ): Promise<VirusTotalTargetResult> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:scan-url',
        url,
      ),

    openVirusTotalReport: (
      reportUrl: string,
    ): Promise<void> =>
      ipcRenderer.invoke(
        'threat-intelligence:virustotal:open-report',
        reportUrl,
      ),
  },
  fileCracker: {
    selectZip: (): Promise<string | null> =>
      ipcRenderer.invoke(
        'file-cracker:select-zip',
      ),

    selectWordlist: (): Promise<string | null> =>
      ipcRenderer.invoke(
        'file-cracker:select-wordlist',
      ),

    crack: (
      request: FileCrackRequest,
    ): Promise<FileCrackResult> =>
      ipcRenderer.invoke(
        'file-cracker:crack',
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
