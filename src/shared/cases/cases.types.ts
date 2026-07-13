export type CaseStatus =
  | 'active'
  | 'paused'
  | 'archived';

export type CaseTargetKind =
  | 'domain'
  | 'ip'
  | 'email'
  | 'url'
  | 'hash'
  | 'file'
  | 'other';

export type CaseActivityStatus =
  | 'success'
  | 'error'
  | 'cancelled'
  | 'info';

export type CaseTarget = {
  id: string;
  kind: CaseTargetKind;
  value: string;
  label: string;
  createdAt: string;
};

export type CaseActivity = {
  id: string;
  caseId: string;
  moduleId: string;
  action: string;
  title: string;
  status: CaseActivityStatus;
  input: unknown;
  output: unknown;
  note: string;
  durationMs: number | null;
  createdAt: string;
};

export type InvestigationCase = {
  id: string;
  name: string;
  description: string;
  status: CaseStatus;
  tags: string[];
  targets: CaseTarget[];
  activities: CaseActivity[];
  createdAt: string;
  updatedAt: string;
};

export type CaseSummary = {
  id: string;
  name: string;
  description: string;
  status: CaseStatus;
  tags: string[];
  targetCount: number;
  activityCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CaseTargetInput = {
  kind: CaseTargetKind;
  value: string;
  label?: string;
};

export type CaseCreateInput = {
  name: string;
  description?: string;
  tags?: string[];
  primaryTarget?: CaseTargetInput;
};

export type CaseActivityCreateInput = {
  caseId: string;
  moduleId: string;
  action: string;
  title: string;
  status: CaseActivityStatus;
  input?: unknown;
  output?: unknown;
  note?: string;
  durationMs?: number | null;
};

export type CaseStoreDocument = {
  format: 'zerohub-cases';
  schemaVersion: 1;
  activeCaseId: string | null;
  cases: InvestigationCase[];
};
