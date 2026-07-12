export type IocProviderName =
  | 'urlhaus'
  | 'malwareBazaar'
  | 'abuseIpDb'
  | 'otx';

export type IocProviderStatus =
  | 'ok'
  | 'no-results'
  | 'not-applicable'
  | 'not-configured'
  | 'error';

export type IocProviderResult = {
  status: IocProviderStatus;
  configured: boolean;
  applicable: boolean;
  matched: boolean | null;
  summary: string | null;
  data: Record<string, unknown> | null;
  error: string | null;
};

export type IocIntelligenceItem = {
  index: number;
  original: string;
  indicator: string;

  type:
    | 'url'
    | 'domain'
    | 'ipv4'
    | 'ipv6'
    | 'md5'
    | 'sha1'
    | 'sha256';

  risk:
    | 'malicious'
    | 'suspicious'
    | 'clean-or-unknown'
    | 'unknown';

  hitCount: number;

  providers: Partial<
    Record<
      IocProviderName,
      IocProviderResult
    >
  >;
};

export type IocIntelligenceResult = {
  generatedAt: string;
  elapsedMs: number;
  selectedServices: IocProviderName[];

  summary: {
    total: number;
    malicious: number;
    suspicious: number;
    cleanOrUnknown: number;
    unknown: number;
  };

  results: IocIntelligenceItem[];
};

export type IocKeyStatus = {
  encryptionAvailable: boolean;
  abuseCh: boolean;
  abuseIpDb: boolean;
  otx: boolean;
};

export type IocKeyInput = {
  abuseCh: string;
  abuseIpDb: string;
  otx: string;
};

export type IocQueryRequest = {
  indicators: string;

  services: Record<
    IocProviderName,
    boolean
  >;
};
