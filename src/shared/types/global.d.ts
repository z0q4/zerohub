import type {
  EncodingTransformRequest,
} from '../encoding/encoding.types';

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
