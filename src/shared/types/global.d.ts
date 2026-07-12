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
} from '../cryptography/cryptography.types';

import type {
  SystemAuditResult,
} from '../system-audit/system-audit.types';

import type {
  LogAnalysisResult,
} from '../log-analysis/log-analysis.types';

import type {
  FileForensicsResult,
} from '../file-forensics/file-forensics.types';

import type {
  SecretScannerResult,
} from '../secret-scanner/secret-scanner.types';

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

  cryptography: {
    createHmac(
      request: {
        key: string;
        message: string;
        algorithm: CryptoAlgorithm;
        encoding: CryptoEncoding;
      },
    ): Promise<HmacResult>;

    verifyHmac(
      request: {
        key: string;
        message: string;
        expected: string;
        algorithm: CryptoAlgorithm;
        encoding: CryptoEncoding;
      },
    ): Promise<HmacVerifyResult>;

    derivePbkdf2(
      request: {
        password: string;
        salt: string;
        algorithm: CryptoAlgorithm;
        iterations: number;
        length: number;
      },
    ): Promise<Pbkdf2Result>;

    generateRandom(
      request: RandomRequest,
    ): Promise<RandomResult>;

    decodeJwt(
      token: string,
    ): Promise<JwtResult>;

    compare(
      left: string,
      right: string,
    ): Promise<CompareResult>;
  };

  systemAudit: {
    run():
      Promise<SystemAuditResult>;
  };

  logAnalysis: {
    inspectFile():
      Promise<LogAnalysisResult | null>;
  };

  fileForensics: {
    inspectFile(
      minStringLength?: number,
    ): Promise<FileForensicsResult | null>;
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
  secretScanner: {
    scanFile(): Promise<SecretScannerResult | null>;
    scanFolder(): Promise<SecretScannerResult | null>;
  };
  fileCracker: {
    selectZip(): Promise<string | null>;

    selectWordlist(): Promise<string | null>;

    crack(
      request: FileCrackRequest,
    ): Promise<FileCrackResult>;
  };
  settings: {
    get(): Promise<AppSettings>;
    save(
      settings: AppSettings,
    ): Promise<AppSettings>;
  };
};

declare global {
  interface Window {
    zeroHub:
      ZeroHubAPI;
  }
}
