export type EmailSecurityFinding = {
  severity:
    | 'high'
    | 'medium'
    | 'low'
    | 'info';

  title: string;
  detail: string;
};

export type EmailSecurityMx = {
  preference: number;
  exchange: string;
  ttl: number;
};

export type SpfMechanism = {
  raw: string;
  qualifier: string;
  name: string;
  value: string | null;
  kind: 'mechanism' | 'modifier';
};

export type EmailSecuritySpf = {
  present: boolean;
  record: string | null;
  records: string[];
  multiple: boolean;
  mechanisms: SpfMechanism[];
  lookupEstimate: number;
  allQualifier: string | null;
  strength: string;
  findings: EmailSecurityFinding[];
};

export type EmailSecurityDmarc = {
  present: boolean;
  record: string | null;
  records: string[];
  multiple: boolean;
  tags: Record<string, string>;
  policy: string | null;
  subdomainPolicy: string | null;
  percentage: number | null;
  strength: string;
  findings: EmailSecurityFinding[];
};

export type EmailSecurityDkim = {
  checked: boolean;
  selector: string | null;
  present: boolean;
  record: string | null;
  records: string[];
  multiple: boolean;
  tags: Record<string, string>;
  keyType: string | null;
  publicKeyPresent: boolean;
  decodedPublicKeyBytes: number | null;
  revoked: boolean;
  findings: EmailSecurityFinding[];
};

export type EmailSecurityQuery = {
  name: string;
  type: number;
  rcode: number;
  nameserver: string;
  elapsedMs: number;
  recordCount: number;
};

export type EmailSecurityResult = {
  domain: string;
  selector: string | null;
  dkimName: string | null;
  nameservers: string[];
  score: number;
  grade: string;

  mx: EmailSecurityMx[];
  spf: EmailSecuritySpf;
  dmarc: EmailSecurityDmarc;
  dkim: EmailSecurityDkim;

  findings: EmailSecurityFinding[];

  raw: {
    rootTxt: string[];
    dmarcTxt: string[];
    dkimTxt: string[];
  };

  queries: EmailSecurityQuery[];
};
