export type UtilityToolId =
  | 'hash'
  | 'file-cracker';

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
    {
      id: 'file-cracker',
      name: 'ZIP Cracker',
      description:
        'Quebre senhas de arquivos ZIP via brute force ou wordlist.',
      abbreviation: 'ZIP',
      status: 'operational',
    },
  ] as const;
