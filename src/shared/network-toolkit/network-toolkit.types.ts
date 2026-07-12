export type PortCheckAttempt = {
  family: string;
  address: string;
  port: number;
  open: boolean;
  elapsedMs: number;
  errorCode: number | null;
  error: string | null;
};

export type PortCheckResult = {
  host: string;
  port: number;
  open: boolean;
  selectedAddress: string | null;
  attempts: PortCheckAttempt[];
  elapsedMs: number;
};

export type TracerouteHop = {
  hop: number;
  addresses: string[];
  rttsMs: number[];
  timeout: boolean;
  raw: string;
};

export type TracerouteResult = {
  host: string;
  tool: string;
  returnCode: number;
  elapsedMs: number;
  hops: TracerouteHop[];
  rawOutput: string;
  stderr: string | null;
};

export type SubnetResult = {
  input: string;
  ip: string;
  version: number;
  prefixLength: number;
  networkAddress: string;
  broadcastAddress: string | null;
  netmask: string;
  hostmask: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableAddresses: number;
  isPrivate: boolean;
  isGlobal: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  reversePointer: string;
};

export type DnsRecord = {
  name: string;
  type: number;
  ttl: number;
  value:
    | string
    | {
        preference: number;
        exchange: string;
      };
};

export type DnsExploreResult = {
  domain: string;
  recordType:
    | 'A'
    | 'AAAA'
    | 'CNAME'
    | 'MX'
    | 'TXT';

  rcode: number;
  nameserver: string;
  elapsedMs: number;
  records: DnsRecord[];
};

export type NetworkInterfaceAddress = {
  family: string | null;
  local: string | null;
  prefixLength: number | null;
  scope: string | null;
  broadcast: string | null;
  label: string | null;
};

export type NetworkInterfaceItem = {
  index: number | null;
  name: string | null;
  state: string | null;
  mtu: number | null;
  mac: string | null;
  broadcast: string | null;
  flags: string[];
  addresses: NetworkInterfaceAddress[];
};

export type NetworkRouteItem = {
  destination: string;
  gateway: string | null;
  device: string | null;
  protocol: string | null;
  scope: string | null;
  source: string | null;
  metric: number | null;
  type: string;
  flags: string[];
};

export type NetworkInterfacesResult = {
  interfaces: NetworkInterfaceItem[];
};

export type NetworkRoutesResult = {
  routes: NetworkRouteItem[];
};
