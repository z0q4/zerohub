export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'CNAME';

export type DnsLookupRequest = {
  domain: string;
  recordType: DnsRecordType;
};

export type DnsLookupResult = {
  domain: string;
  recordType: DnsRecordType;
  records: string[];
  elapsedMs: number;
};
