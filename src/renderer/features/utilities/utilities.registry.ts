export type UtilityToolId =
  | 'hash';

export type UtilityToolDefinition = {
  id: UtilityToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: 'operational';
};

export const UTILITY_TOOL_REGISTRY:
  readonly UtilityToolDefinition[] = [
    {
      id: 'hash',
      name: 'Hash Generator',
      description:
        'Gere hashes de textos e arquivos locais.',
      abbreviation: 'HSH',
      status: 'operational',
    },
  ] as const;
