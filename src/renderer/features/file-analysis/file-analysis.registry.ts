export type FileAnalysisToolId =
  | 'file-inspector';

export type FileAnalysisToolDefinition = {
  id: FileAnalysisToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: 'operational';
};

export const FILE_ANALYSIS_TOOL_REGISTRY:
  readonly FileAnalysisToolDefinition[] = [
    {
      id: 'file-inspector',
      name: 'File Inspector',
      description:
        'Analise tipo, hashes, entropia e metadados de arquivos.',
      abbreviation: 'FIL',
      status: 'operational',
    },
  ] as const;
