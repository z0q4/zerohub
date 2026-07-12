export type WebReconRedirect = {
  index: number;
  url: string;
  statusCode: number;
  reason: string;
  location: string | null;
  elapsedMs: number;
};

export type WebReconSecurityHeader = {
  name: string;
  status:
    | 'present'
    | 'missing'
    | 'not-applicable';

  severity:
    | 'none'
    | 'low'
    | 'medium'
    | 'high';

  value: string | null;
  matchedHeader: string | null;
  recommendation: string;
};

export type WebReconTextResource = {
  url: string;
  statusCode: number | null;
  found: boolean;
  contentType: string | null;
  content: string | null;
  truncated: boolean;
  elapsedMs: number | null;
  error: string | null;
};

export type WebReconTls = {
  available: boolean;
  verified: boolean | null;
  error: string | null;
  hostname: string | null;
  port: number;
  handshakeMs: number | null;
  tlsVersion: string | null;
  cipher: string | null;
  subject: string | null;
  issuer: string | null;
  serialNumber: string | null;
  notBefore: string | null;
  notAfter: string | null;
  daysRemaining: number | null;
  subjectAltNames: string[];
};

export type WebReconResult = {
  requestedUrl: string;
  finalUrl: string;
  hostname: string | null;
  scheme: 'http' | 'https';
  port: number;
  resolvedAddresses: string[];

  statusCode: number;
  reason: string;
  elapsedMs: number;
  title: string | null;
  server: string | null;
  contentType: string | null;
  contentLength: string | null;

  headers: Record<string, string>;
  bodyPreview: string;
  bodyTruncated: boolean;

  redirectChain: WebReconRedirect[];

  securityHeaders: {
    score: number;
    present: number;
    total: number;
    checks: WebReconSecurityHeader[];
  };

  tls: WebReconTls;
  robots: WebReconTextResource;
  sitemap: WebReconTextResource;
  discoveredSitemaps: string[];
};
