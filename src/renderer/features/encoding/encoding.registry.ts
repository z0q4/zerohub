export type EncodingToolId =
  | 'base64'
  | 'url'
  | 'hex';

export type EncodingToolStatus =
  | 'operational'
  | 'planned';

export type EncodingToolDefinition = {
  id: EncodingToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: EncodingToolStatus;
};

export const ENCODING_TOOL_REGISTRY:
  readonly EncodingToolDefinition[] = [
    {
      id: 'base64',
      name: 'Base64',
      description:
        'Codificação e decodificação de textos UTF-8.',
      abbreviation: 'B64',
      status: 'operational',
    },
    {
      id: 'url',
      name: 'URL Encode',
      description:
        'Codificação percentual para componentes de URLs.',
      abbreviation: 'URL',
      status: 'operational',
    },
    {
      id: 'hex',
      name: 'Hexadecimal',
      description:
        'Conversão entre textos UTF-8 e hexadecimal.',
      abbreviation: 'HEX',
      status: 'operational',
    },
  ] as const;

export function getEncodingToolById(
  id: EncodingToolId,
): EncodingToolDefinition {
  const tool =
    ENCODING_TOOL_REGISTRY.find(
      (item) => item.id === id,
    );

  if (!tool) {
    throw new Error(
      `A ferramenta "${id}" não está registrada.`,
    );
  }

  return tool;
}
