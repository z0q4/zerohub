export type NetworkToolId =
  | 'dns-lookup'
  | 'ping';

export type NetworkToolDefinition = {
  id: NetworkToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: 'operational';
};

export const NETWORK_TOOL_REGISTRY:
  readonly NetworkToolDefinition[] = [
    {
      id: 'dns-lookup',
      name: 'DNS Lookup',
      description:
        'Consulte registros DNS de domínios.',
      abbreviation: 'DNS',
      status: 'operational',
    },
    {
      id: 'ping',
      name: 'Ping',
      description:
        'Teste conectividade e latência de hosts.',
      abbreviation: 'PNG',
      status: 'operational',
    },
  ] as const;
