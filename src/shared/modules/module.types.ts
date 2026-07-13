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
  | 'cryptography'
  | 'web-recon'
  | 'email-security'
  | 'network-toolkit'
  | 'developer-tools'
  | 'ioc-intelligence'
  | 'cases';

export type ModuleStatus =
  | 'operational'
  | 'planned';

export type ModuleSection =
  | 'workspace'
  | 'intelligence'
  | 'analysis'
  | 'network'
  | 'data-dev'
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
