export type SecretScannerToolId = 'project-secrets';

export const SECRET_SCANNER_TOOL_REGISTRY = [
  {
    id: 'project-secrets',
    name: 'Project Secrets',
    description: 'Localize credenciais e arquivos de ambiente expostos.',
    abbreviation: 'SEC',
    status: 'operational',
  },
] as const;
