export type SystemAuditCpu = {
  model: string | null;
  logicalCores: number;
  architecture: string;
};

export type SystemAuditMemory = {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
};

export type SystemAuditDisk = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
};

export type SystemAuditProcess = {
  pid: number;
  name: string;
  state: string;
  user: string | null;
  uid: number | null;
  memoryBytes: number;
  threads: number;
};

export type SystemAuditPort = {
  protocol: string;
  state: string;
  localAddress: string;
  localPort: string;
  processName: string | null;
  pid: number | null;
};

export type SystemAuditService = {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
};

export type SystemAuditStartupItem = {
  name: string;
  path: string;
  scope: 'user' | 'system';
  command: string | null;
  hidden: boolean;
};

export type SystemAuditPermissionRisk = {
  severity: 'high' | 'medium';
  category: string;
  path: string;
  description: string;
  permissions: string;
};

export type SystemAuditFirewall = {
  name: string;
  active: boolean;
  state: string;
};

export type SystemAuditResult = {
  generatedAt: string;
  elapsedMs: number;

  system: {
    hostname: string;
    platform: string;
    kernel: string;
    distribution: string;
    uptimeSeconds: number | null;
    cpu: SystemAuditCpu;
    memory: SystemAuditMemory;
    disk: SystemAuditDisk;
  };

  user: {
    username: string;
    uid: number;
    gid: number;
    groups: string[];
    home: string;
    isRoot: boolean;
  };

  security: {
    secureBoot: {
      available: boolean;
      enabled: boolean | null;
      details: string;
    };

    apparmorEnabled: boolean | null;
    aslrMode: number | null;
    ptraceScope: number | null;
    firewalls: SystemAuditFirewall[];
  };

  processes: SystemAuditProcess[];
  listeningPorts: SystemAuditPort[];
  services: SystemAuditService[];
  startupItems: SystemAuditStartupItem[];
  permissionRisks: SystemAuditPermissionRisk[];

  counts: {
    processes: number;
    listeningPorts: number;
    services: number;
    startupItems: number;
    permissionRisks: number;
  };

  limits: {
    processes: number;
    listeningPorts: number;
    services: number;
    startupItems: number;
    permissionRisks: number;
  };
};
