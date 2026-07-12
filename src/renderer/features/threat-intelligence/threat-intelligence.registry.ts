export type ThreatIntelligenceToolId =
  | 'virustotal-file';

export type ThreatIntelligenceToolDefinition = {
  id: ThreatIntelligenceToolId;
  name: string;
  description: string;
  abbreviation: string;
  status: 'operational';
};

export const THREAT_INTELLIGENCE_TOOL_REGISTRY:
  readonly ThreatIntelligenceToolDefinition[] = [
    {
      id: 'virustotal-file',
      name: 'VirusTotal Scanner',
      description:
        'Analise arquivos e URLs usando a API do VirusTotal.',
      abbreviation: 'VT',
      status: 'operational',
    },
  ] as const;
