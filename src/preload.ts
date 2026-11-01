import type { IbgeBoundary, IbgeMunicipality } from './shared/municipal-boundaries/municipal-boundaries.types';
import type { RecifeNeighborhood, RecifeStreet } from './shared/recife-geometry/recife-geometry.types';
import type { IntelligenceQuery, IntelligenceResponse } from './shared/intelligence-layers/intelligence-types';
import type {
  CaseActivity,
  CaseActivityCreateInput,
  CaseCreateInput,
  CasePrimaryTargetInput,
  CaseStatus,
  CaseSummary,
  CaseTargetCreateInput,
  CaseTargetRemoveInput,
  CaseUpdateInput,
  InvestigationCase,
} from './shared/cases/cases.types';

import type {
  IocIntelligenceResult,
  IocKeyInput,
  IocKeyStatus,
  IocQueryRequest,
} from './shared/ioc-intelligence/ioc-intelligence.types';

import type {
  IpGeolocationLookupRequest,
  IpGeolocationLookupResponse,
  IpPublicLookupResponse,
} from './shared/ip-geolocation/ip-geolocation.types';

import type {
  GeographicReverseRequest,
  GeographicReverseResponse,
  GeographicSearchRequest,
  GeographicSearchResponse,
} from './shared/geographic-search/geographic-search.types';

import type {
  GoogleEmbedRequest,
  GoogleEmbedSession,
  MapProviderKeyStatus,
} from './shared/map-providers/map-providers.types';

import type {
  DiffResult,
  JsonFormatResult,
  RegexTestResult,
  TextConvertResult,
  TimestampConvertResult,
  UuidGenerateResult,
} from './shared/developer-tools/developer-tools.types';

import type {
  DnsExploreResult,
  NetworkInterfacesResult,
  NetworkRoutesResult,
  PortCheckResult,
  SubnetResult,
  TracerouteResult,
} from './shared/network-toolkit/network-toolkit.types';

import type {
  EmailSecurityResult,
} from './shared/email-security/email-security.types';

import type {
  WebReconResult,
} from './shared/web-recon/web-recon.types';

import type {
  CompareResult,
  CryptoAlgorithm,
  CryptoEncoding,
  HmacResult,
  HmacVerifyResult,
  JwtResult,
  Pbkdf2Result,
  RandomRequest,
  RandomResult,
} from './shared/cryptography/cryptography.types';

import type {
  SystemAuditResult,
} from './shared/system-audit/system-audit.types';

import type {
  LogAnalysisResult,
} from './shared/log-analysis/log-analysis.types';

import type {
  FileForensicsResult,
} from './shared/file-forensics/file-forensics.types';

import type {
  SecretScannerResult,
} from './shared/secret-scanner/secret-scanner.types';

import {
  contextBridge,
  ipcRenderer as electronIpcRenderer,
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
  AuthAttemptResult,
  AuthCredentialsInput,
  AuthSetupInput,
  AuthStatus,
  AuthUnlockInput,
  AuthUnlockSetupInput,
} from './shared/auth/auth.types';

import type {
  VirusTotalSecretStatus,
  VirusTotalTargetResult,
} from './shared/threat-intelligence/threat-intelligence.types';

import type {
  FileCrackRequest,
  FileCrackResult,
} from './shared/file-cracker/file-cracker.types';

const AUTH_IPC_CHANNELS = new Set([
  'auth:status',
  'auth:setup',
  'auth:login',
  'auth:setup-unlock',
  'auth:unlock',
  'auth:lock',
]);

let rendererAuthLocked = true;

const guardedInvoke:
  Electron.IpcRenderer['invoke'] = (
    channel,
    ...args
  ) => {
    if (
      rendererAuthLocked &&
      !AUTH_IPC_CHANNELS.has(
        channel,
      )
    ) {
      return Promise.reject(
        new Error(
          'A sessão local está bloqueada.',
        ),
      );
    }

    return electronIpcRenderer.invoke(
      channel,
      ...args,
    );
  };

const ipcRenderer = {
  invoke: guardedInvoke,
};

const zeroHubAPI = {
  auth: {
    getStatus: async ():
      Promise<AuthStatus> => {
      const status: AuthStatus =
        await ipcRenderer.invoke(
        'auth:status',
        );

      rendererAuthLocked =
        status.locked;

      return status;
    },

    setup: async (
      input: AuthSetupInput,
    ): Promise<AuthAttemptResult> => {
      const result:
        AuthAttemptResult =
        await ipcRenderer.invoke(
        'auth:setup',
        input,
        );

      rendererAuthLocked =
        result.status.locked;

      return result;
    },

    login: async (
      input: AuthCredentialsInput,
    ): Promise<AuthAttemptResult> => {
      const result:
        AuthAttemptResult =
        await ipcRenderer.invoke(
        'auth:login',
        input,
        );

      rendererAuthLocked =
        result.status.locked;

      return result;
    },

    setupUnlock: async (
      input: AuthUnlockSetupInput,
    ): Promise<AuthAttemptResult> => {
      const result:
        AuthAttemptResult =
        await ipcRenderer.invoke(
          'auth:setup-unlock',
          input,
        );

      rendererAuthLocked =
        result.status.locked;

      return result;
    },

    unlock: async (
      input: AuthUnlockInput,
    ): Promise<AuthAttemptResult> => {
      const result:
        AuthAttemptResult =
        await ipcRenderer.invoke(
          'auth:unlock',
          input,
        );

      rendererAuthLocked =
        result.status.locked;

      return result;
    },

    lock: async ():
      Promise<AuthStatus> => {
      const status: AuthStatus =
        await ipcRenderer.invoke(
        'auth:lock',
        );

      rendererAuthLocked = true;

      return status;
    },

    onLocked: (
      listener: (
        status: AuthStatus,
      ) => void,
    ): (() => void) => {
      const handleLocked = (
        _event: Electron.IpcRendererEvent,
        status: AuthStatus,
      ): void => {
        rendererAuthLocked = true;
        listener(status);
      };

      electronIpcRenderer.on(
        'auth:locked',
        handleLocked,
      );

      return () => {
        electronIpcRenderer.removeListener(
          'auth:locked',
          handleLocked,
        );
      };
    },
  },

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
    ): Promise<void> => {
      if (
        typeof text !==
        'string'
      ) {
        throw new TypeError(
          'O conteúdo do clipboard precisa ser uma string.',
        );
      }

      return ipcRenderer.invoke(
        'clipboard:write-text',
        text,
      );
    },
  },

  geographicSearch: {
    search: (
      request:
        GeographicSearchRequest,
    ): Promise<GeographicSearchResponse> =>
      ipcRenderer.invoke(
        'geographic-search:search',
        request,
      ),

    reverse: (
      request:
        GeographicReverseRequest,
    ): Promise<GeographicReverseResponse> =>
      ipcRenderer.invoke(
        'geographic-search:reverse',
        request,
      ),

    cancel: (
      requestId: string,
    ): Promise<boolean> =>
      ipcRenderer.invoke(
        'geographic-search:cancel',
        requestId,
      ),

    clearCache: (): Promise<boolean> =>
      ipcRenderer.invoke(
        'geographic-search:clear-cache',
      ),
  },

  ibgeBoundaries: {
    list: (state: string, requestId: string): Promise<IbgeMunicipality[]> => ipcRenderer.invoke('ibge-boundaries:list', state, requestId),
    geometry: (state: string, code: string, requestId: string): Promise<IbgeBoundary> => ipcRenderer.invoke('ibge-boundaries:geometry', state, code, requestId),
    cancel: (requestId: string): Promise<boolean> => ipcRenderer.invoke('ibge-boundaries:cancel', requestId),
  },

  intelligenceLayers: {
    query: (request: IntelligenceQuery): Promise<IntelligenceResponse> => ipcRenderer.invoke('intelligence-layers:query', request),
    cancel: (requestId: string): Promise<boolean> => ipcRenderer.invoke('intelligence-layers:cancel', requestId),
  },

  recifeGeometry: {
    neighborhood: (city: string, name: string, requestId: string, savedCode?: string): Promise<RecifeNeighborhood | null> => ipcRenderer.invoke('recife-geometry:neighborhood', city, name, requestId, savedCode),
    street: (city: string, neighborhood: string, name: string, requestId: string, savedCode?: string): Promise<RecifeStreet | null> => ipcRenderer.invoke('recife-geometry:street', city, neighborhood, name, requestId, savedCode),
    cancel: (requestId: string): Promise<boolean> => ipcRenderer.invoke('recife-geometry:cancel', requestId),
  },

  ipGeolocation: {
    lookup: (
      request:
        IpGeolocationLookupRequest,
    ): Promise<IpGeolocationLookupResponse> =>
      ipcRenderer.invoke(
        'ip-geolocation:lookup',
        request,
      ),

    lookupPublic: (
      requestId: string,
    ): Promise<IpPublicLookupResponse> =>
      ipcRenderer.invoke(
        'ip-geolocation:lookup-public',
        requestId,
      ),

    cancel: (
      requestId: string,
    ): Promise<boolean> =>
      ipcRenderer.invoke(
        'ip-geolocation:cancel',
        requestId,
      ),
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

  iocIntelligence: {
    keyStatus: ():
      Promise<IocKeyStatus> =>
      ipcRenderer.invoke(
        'ioc-intelligence:key-status',
      ),

    saveKeys: (
      keys: IocKeyInput,
    ): Promise<IocKeyStatus> =>
      ipcRenderer.invoke(
        'ioc-intelligence:save-keys',
        keys,
      ),

    clearKeys: ():
      Promise<IocKeyStatus> =>
      ipcRenderer.invoke(
        'ioc-intelligence:clear-keys',
      ),

    query: (
      request: IocQueryRequest,
    ): Promise<IocIntelligenceResult> =>
      ipcRenderer.invoke(
        'ioc-intelligence:query',
        request,
      ),
  },

  developerTools: {
    formatJson: (
      request: {
        text: string;
        indent: number;
        sortKeys: boolean;
        minify: boolean;
      },
    ): Promise<JsonFormatResult> =>
      ipcRenderer.invoke(
        'developer-tools:json',
        request,
      ),

    convertYaml: (
      text: string,
      direction: string,
    ): Promise<TextConvertResult> =>
      ipcRenderer.invoke(
        'developer-tools:yaml',
        text,
        direction,
      ),

    convertToml: (
      text: string,
      direction: string,
    ): Promise<TextConvertResult> =>
      ipcRenderer.invoke(
        'developer-tools:toml',
        text,
        direction,
      ),

    testRegex: (
      request: {
        pattern: string;
        text: string;
        flags: string;
        replacement: string;
      },
    ): Promise<RegexTestResult> =>
      ipcRenderer.invoke(
        'developer-tools:regex',
        request,
      ),

    generateUuid: (
      request: {
        version: string;
        count: number;
        namespace: string;
        name: string;
      },
    ): Promise<UuidGenerateResult> =>
      ipcRenderer.invoke(
        'developer-tools:uuid',
        request,
      ),

    convertTimestamp: (
      value: string,
    ): Promise<TimestampConvertResult> =>
      ipcRenderer.invoke(
        'developer-tools:timestamp',
        value,
      ),

    diff: (
      request: {
        left: string;
        right: string;
        leftLabel: string;
        rightLabel: string;
      },
    ): Promise<DiffResult> =>
      ipcRenderer.invoke(
        'developer-tools:diff',
        request,
      ),
  },

  networkToolkit: {
    checkPort: (
      request: {
        host: string;
        port: number;
        timeoutMs: number;
      },
    ): Promise<PortCheckResult> =>
      ipcRenderer.invoke(
        'network-toolkit:port-check',
        request,
      ),

    traceroute: (
      request: {
        host: string;
        maxHops: number;
      },
    ): Promise<TracerouteResult> =>
      ipcRenderer.invoke(
        'network-toolkit:traceroute',
        request,
      ),

    calculateSubnet: (
      network: string,
    ): Promise<SubnetResult> =>
      ipcRenderer.invoke(
        'network-toolkit:subnet',
        network,
      ),

    dnsLookup: (
      domain: string,
      recordType: string,
    ): Promise<DnsExploreResult> =>
      ipcRenderer.invoke(
        'network-toolkit:dns',
        domain,
        recordType,
      ),

    listInterfaces: ():
      Promise<NetworkInterfacesResult> =>
      ipcRenderer.invoke(
        'network-toolkit:interfaces',
      ),

    listRoutes: ():
      Promise<NetworkRoutesResult> =>
      ipcRenderer.invoke(
        'network-toolkit:routes',
      ),
  },

  emailSecurity: {
    inspect: (
      domain: string,
      selector = '',
    ): Promise<EmailSecurityResult> =>
      ipcRenderer.invoke(
        'email-security:inspect',
        domain,
        selector,
      ),
  },

  webRecon: {
    inspect: (
      url: string,
    ): Promise<WebReconResult> =>
      ipcRenderer.invoke(
        'web-recon:inspect',
        url,
      ),
  },

  cryptography: {
    createHmac: (
      request: {
        key: string;
        message: string;
        algorithm: CryptoAlgorithm;
        encoding: CryptoEncoding;
      },
    ): Promise<HmacResult> =>
      ipcRenderer.invoke(
        'cryptography:hmac-create',
        request,
      ),

    verifyHmac: (
      request: {
        key: string;
        message: string;
        expected: string;
        algorithm: CryptoAlgorithm;
        encoding: CryptoEncoding;
      },
    ): Promise<HmacVerifyResult> =>
      ipcRenderer.invoke(
        'cryptography:hmac-verify',
        request,
      ),

    derivePbkdf2: (
      request: {
        password: string;
        salt: string;
        algorithm: CryptoAlgorithm;
        iterations: number;
        length: number;
      },
    ): Promise<Pbkdf2Result> =>
      ipcRenderer.invoke(
        'cryptography:pbkdf2',
        request,
      ),

    generateRandom: (
      request: RandomRequest,
    ): Promise<RandomResult> =>
      ipcRenderer.invoke(
        'cryptography:random',
        request,
      ),

    decodeJwt: (
      token: string,
    ): Promise<JwtResult> =>
      ipcRenderer.invoke(
        'cryptography:jwt',
        token,
      ),

    compare: (
      left: string,
      right: string,
    ): Promise<CompareResult> =>
      ipcRenderer.invoke(
        'cryptography:compare',
        left,
        right,
      ),
  },

  systemAudit: {
    run: ():
      Promise<SystemAuditResult> =>
      ipcRenderer.invoke(
        'system-audit:run',
      ),
  },

  logAnalysis: {
    inspectFile: ():
      Promise<LogAnalysisResult | null> =>
      ipcRenderer.invoke(
        'log-analysis:inspect-file',
      ),
  },

  fileForensics: {
    inspectFile: (
      minStringLength = 5,
    ): Promise<FileForensicsResult | null> =>
      ipcRenderer.invoke(
        'file-forensics:inspect-file',
        minStringLength,
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
  secretScanner: {
    scanFile: (): Promise<SecretScannerResult | null> =>
      ipcRenderer.invoke('secret-scanner:scan-file'),

    scanFolder: (): Promise<SecretScannerResult | null> =>
      ipcRenderer.invoke('secret-scanner:scan-folder'),
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
  cases: {
    list: ():
      Promise<CaseSummary[]> =>
      ipcRenderer.invoke(
        'cases:list',
      ),

    get: (
      caseId: string,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:get',
        caseId,
      ),

    getActive: ():
      Promise<InvestigationCase | null> =>
      ipcRenderer.invoke(
        'cases:get-active',
      ),

    create: (
      input: CaseCreateInput,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:create',
        input,
      ),

    setActive: (
      caseId: string | null,
    ): Promise<InvestigationCase | null> =>
      ipcRenderer.invoke(
        'cases:set-active',
        caseId,
      ),

    addActivity: (
      input: CaseActivityCreateInput,
    ): Promise<CaseActivity> =>
      ipcRenderer.invoke(
        'cases:add-activity',
        input,
      ),

    update: (
      input: CaseUpdateInput,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:update',
        input,
      ),

    addTarget: (
      input: CaseTargetCreateInput,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:add-target',
        input,
      ),

    removeTarget: (
      input: CaseTargetRemoveInput,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:remove-target',
        input,
      ),

    setPrimaryTarget: (
      input: CasePrimaryTargetInput,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:set-primary-target',
        input,
      ),

    updateStatus: (
      caseId: string,
      status: CaseStatus,
    ): Promise<InvestigationCase> =>
      ipcRenderer.invoke(
        'cases:update-status',
        caseId,
        status,
      ),
  },

  settings: {
    get: ():
      Promise<AppSettings> =>
      ipcRenderer.invoke(
        'settings:get',
      ),

    save: (
      settings: AppSettings,
    ): Promise<AppSettings> =>
      ipcRenderer.invoke(
        'settings:save',
        settings,
      ),
  },

  mapProviders: {
    getGoogleKeyStatus: ():
      Promise<MapProviderKeyStatus> =>
      ipcRenderer.invoke(
        'map-providers:google-key-status',
      ),

    saveGoogleApiKey: (
      apiKey: string,
    ): Promise<MapProviderKeyStatus> =>
      ipcRenderer.invoke(
        'map-providers:save-google-key',
        apiKey,
      ),

    removeGoogleApiKey: ():
      Promise<MapProviderKeyStatus> =>
      ipcRenderer.invoke(
        'map-providers:remove-google-key',
      ),

    createGoogleEmbed: (
      request: GoogleEmbedRequest,
    ): Promise<GoogleEmbedSession> =>
      ipcRenderer.invoke(
        'map-providers:create-google-embed',
        request,
      ),
  },
};

contextBridge.exposeInMainWorld(
  'zeroHub',
  zeroHubAPI,
);
