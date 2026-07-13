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
    id: 'cases',
    name: 'Perfis do alvo',
    description:
      'Perfis persistentes, alvos e timeline de investigação.',
    abbreviation: 'CASE',
    icon: '◉',
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
    section: 'network',
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
    section: 'intelligence',
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
    section: 'data-dev',
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
    section: 'data-dev',
    showOnDashboard: true,
  },
  {
    id: 'file-analysis',
    name: 'File Analysis',
    description:
      'Inspeção de arquivos, hashes, entropia e metadados locais.',
    icon: 'FI',
    abbreviation: 'FIL',
    section: 'analysis',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'threat-intelligence',
    name: 'Threat Intelligence',
    description:
      'Consulta reputação e detecções de arquivos por hash.',
    icon: 'TI',
    abbreviation: 'THR',
    section: 'intelligence',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'secret-scanner',
    name: 'Secret Scanner',
    description:
      'Auditoria local de tokens, chaves, senhas e arquivos .env.',
    icon: 'SS',
    abbreviation: 'SEC',
    section: 'analysis',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'file-forensics',
    name: 'File Forensics',
    description:
      'Strings, IOCs, cabeçalhos binários e conteúdo de arquivos ZIP.',
    icon: 'FF',
    abbreviation: 'FOR',
    section: 'analysis',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'log-analysis',
    name: 'Log Analysis',
    description:
      'Analise logs HTTP, SSH, JSON Lines e eventos genéricos.',
    icon: 'LG',
    abbreviation: 'LOG',
    section: 'analysis',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'system-audit',
    name: 'System Audit',
    description:
      'Processos, portas, serviços, inicialização e segurança do Linux.',
    icon: 'SA',
    abbreviation: 'SYS',
    section: 'analysis',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'cryptography',
    name: 'Cryptography',
    description:
      'HMAC, PBKDF2, geração segura, JWT e comparação constante.',
    icon: 'CR',
    abbreviation: 'CRY',
    section: 'data-dev',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'web-recon',
    name: 'Web Recon',
    description:
      'HTTP, redirects, security headers, TLS, robots.txt e sitemap.',
    icon: 'WR',
    abbreviation: 'WEB',
    section: 'intelligence',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'email-security',
    name: 'Email Security',
    description:
      'Audite MX, SPF, DMARC e DKIM usando consultas DNS.',
    icon: 'ES',
    abbreviation: 'MAIL',
    section: 'intelligence',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'network-toolkit',
    name: 'Network Toolkit',
    description:
      'Port Check, Traceroute, Subnet, DNS, Interfaces e Rotas.',
    icon: 'NT',
    abbreviation: 'NET',
    section: 'network',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'developer-tools',
    name: 'Developer Tools',
    description:
      'JSON, YAML, TOML, Regex, UUID, Timestamp e Diff.',
    icon: 'DT',
    abbreviation: 'DEV',
    section: 'data-dev',
    status: 'operational',
    showOnDashboard: true,
  },
  {
    id: 'ioc-intelligence',
    name: 'IOC Intelligence',
    description:
      'URLhaus, MalwareBazaar, AbuseIPDB e OTX em uma consulta.',
    icon: 'TI',
    abbreviation: 'IOC',
    section: 'intelligence',
    status: 'operational',
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
