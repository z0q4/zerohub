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
};

contextBridge.exposeInMainWorld(
  'zeroHub',
  zeroHubAPI,
);