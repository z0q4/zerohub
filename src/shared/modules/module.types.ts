export type ModuleId =
  | 'dashboard'
  | 'network'
  | 'osint'
  | 'encoding'
  | 'utilities'
  | 'settings'
  | 'file-analysis'
  | 'threat-intelligence'
  | 'secret-scanner'
  | 'file-forensics'
  | 'log-analysis'
  | 'system-audit'
  | 'cryptography';

export type ModuleStatus =
  | 'operational'
  | 'planned';

export type ModuleSection =
  | 'workspace'
  | 'system';

export type ModuleDefinition = {
  id: ModuleId;
  name: string;
  description: string;
  abbreviation: string;
  icon: string;
  status: ModuleStatus;
  section: ModuleSection;
  showOnDashboard: boolean;
};
