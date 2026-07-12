import type {
  EncodingTransformRequest,
} from '../encoding/encoding.types';

import type {
  FileAnalysisResult,
} from '../file-analysis/file-analysis.types';

import type {
  HashAlgorithm,
  HashFileResult,
  HashTextRequest,
} from '../hash/hash.types';

import type {
  DnsLookupRequest,
  DnsLookupResult,
} from '../network/dns.types';

import type {
  PingRequest,
  PingResult,
} from '../network/ping.types';

import type {
  RdapDomainRequest,
  RdapDomainResult,
} from '../osint/rdap.types';

import type {
  AppSettings,
} from '../settings/settings.types';

import type {
  VirusTotalSecretStatus,
  VirusTotalTargetResult,
} from '../threat-intelligence/threat-intelligence.types';

import type {
  FileCrackRequest,
  FileCrackResult,
} from '../file-cracker/file-cracker.types';

export {};

type RuntimeInfo = {
  platform: string;
  electronVersion: string;
  nodeVersion: string;
  chromiumVersion: string;
};

type ZeroHubAPI = {
  system: {
    getRuntimeInfo():
      RuntimeInfo;
  };

  clipboard: {
    writeText(
      text: string,
    ): void;
  };

  encoding: {
    transform(
      request:
        EncodingTransformRequest,
    ): Promise<string>;
  };

  fileAnalysis: {
    inspectFile():
      Promise<FileAnalysisResult | null>;
  };

  hash: {
    text(
      request:
        HashTextRequest,
    ): Promise<string>;

    selectFile(
      algorithm:
        HashAlgorithm,
    ): Promise<
      HashFileResult | null
    >;
  };

  network: {
    dnsLookup(
      request:
        DnsLookupRequest,
    ): Promise<DnsLookupResult>;

    ping(
      request:
        PingRequest,
    ): Promise<PingResult>;
  };

  osint: {
    rdapDomain(
      request:
        RdapDomainRequest,
    ): Promise<RdapDomainResult>;
  };

  threatIntelligence: {
    getVirusTotalStatus():
      Promise<VirusTotalSecretStatus>;

    saveVirusTotalApiKey(
      apiKey: string,
    ): Promise<VirusTotalSecretStatus>;

    removeVirusTotalApiKey():
      Promise<VirusTotalSecretStatus>;

    lookupVirusTotalFile():
      Promise<VirusTotalTargetResult | null>;

    refreshVirusTotalFile():
      Promise<VirusTotalTargetResult>;

    uploadVirusTotalFile():
      Promise<VirusTotalTargetResult | null>;

    lookupVirusTotalUrl(
      url: string,
    ): Promise<VirusTotalTargetResult>;

    scanVirusTotalUrl(
      url: string,
    ): Promise<VirusTotalTargetResult>;

    openVirusTotalReport(
      reportUrl: string,
    ): Promise<void>;
  };

  fileCracker: {
    selectZip():
      Promise<string | null>;

    selectWordlist():
      Promise<string | null>;

    crack(
      request: FileCrackRequest,
    ): Promise<FileCrackResult>;
  };

  settings: {
    get():
      Promise<AppSettings>;

    save(
      settings:
        AppSettings,
    ): Promise<AppSettings>;
  };
};

declare global {
  interface Window {
    zeroHub:
      ZeroHubAPI;
  }
}
