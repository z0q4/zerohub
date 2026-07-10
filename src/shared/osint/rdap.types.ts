export type RdapDomainRequest = {
  domain: string;
};

export type RdapEvent = {
  action: string;
  date: string;
};

export type RdapEntity = {
  handle: string | null;
  name: string | null;
  roles: string[];
};

export type RdapDomainResult = {
  domain: string;
  unicodeName: string | null;
  handle: string | null;
  status: string[];
  nameservers: string[];
  events: RdapEvent[];
  entities: RdapEntity[];
  notices: string[];
  port43: string | null;
  secureDns: boolean | null;
  sourceUrl: string;
  elapsedMs: number;
  rawJson: string;
};
