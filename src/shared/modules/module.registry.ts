import type {
  ModuleDefinition,
  ModuleId,
  ModuleSection,
} from './module.types';

export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description:
      'Visão geral dos módulos e ferramentas do ZeroHub.',
    abbreviation: 'DB',
    icon: '⌂',
    status: 'operational',
    section: 'workspace',
    showOnDashboard: false,
  },
  {
    id: 'network',
    name: 'Network',
    description:
      'Diagnóstico, análise e ferramentas de rede.',
    abbreviation: 'NW',
    icon: '◇',
    status: 'operational',
    section: 'workspace',
    showOnDashboard: true,
  },
  {
    id: 'osint',
    name: 'OSINT',
    description:
      'Coleta e organização de informações públicas.',
    abbreviation: 'OS',
    icon: '◎',
    status: 'operational',
    section: 'workspace',
    showOnDashboard: true,
  },
  {
    id: 'encoding',
    name: 'Encoding',
    description:
      'Codificação, decodificação e conversão de dados.',
    abbreviation: 'EN',
    icon: '⌘',
    status: 'operational',
    section: 'workspace',
    showOnDashboard: true,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    description:
      'Ferramentas rápidas para tarefas técnicas.',
    abbreviation: 'UT',
    icon: '□',
    status: 'operational',
    section: 'workspace',
    showOnDashboard: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    description:
      'Preferências e configurações do ZeroHub.',
    abbreviation: 'ST',
    icon: '⚙',
    status: 'operational',
    section: 'system',
    showOnDashboard: false,
  },
] as const;

export function getModuleById(
  id: ModuleId,
): ModuleDefinition {
  const moduleDefinition = MODULE_REGISTRY.find(
    (module) => module.id === id,
  );

  if (!moduleDefinition) {
    throw new Error(
      `O módulo "${id}" não está registrado.`,
    );
  }

  return moduleDefinition;
}

export function getModulesBySection(
  section: ModuleSection,
): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(
    (module) => module.section === section,
  );
}

export function getDashboardModules(): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(
    (module) => module.showOnDashboard,
  );
}

export function getOperationalModules(): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(
    (module) => module.status === 'operational',
  );
}
