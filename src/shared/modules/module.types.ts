export type ModuleId =
  | 'dashboard'
  | 'network'
  | 'osint'
  | 'encoding'
  | 'utilities'
  | 'settings';

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
