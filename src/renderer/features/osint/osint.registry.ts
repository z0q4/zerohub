export type OsintToolId =
  | 'rdap-domain';

export type OsintToolDefinition = {
  id: OsintToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: 'operational';
};

export const OSINT_TOOL_REGISTRY:
  readonly OsintToolDefinition[] = [
    {
      id: 'rdap-domain',
      name: 'RDAP Domain',
      description:
        'Consulte informações públicas de registro de domínios.',
      abbreviation: 'RDP',
      status: 'operational',
    },
  ] as const;
