export type VirusTotalSecretStatus = {
  configured: boolean;
  storageBackend: string;
  protectedByOs: boolean;
};

export type VirusTotalStats = {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
  failure: number;
  typeUnsupported: number;
  confirmedTimeout: number;
};

export type VirusTotalEngineResult = {
  engineName: string;
  category: string;
  result: string | null;
  engineVersion: string | null;
  engineUpdate: string | null;
};

export type VirusTotalReport = {
  meaningfulName: string | null;
  title: string | null;
  typeDescription: string | null;
  typeExtension: string | null;
  sizeBytes: number;
  reputation: number;
  timesSubmitted: number;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
  lastAnalysisAt: string | null;
  lastFinalUrl: string | null;
  httpResponseCode: number | null;
  tags: string[];
  names: string[];
  stats: VirusTotalStats;
  totalEngines: number;
  detectedEngines: number;
  verdict: 'malicious' | 'suspicious' | 'no-detections';
  engines: VirusTotalEngineResult[];
};

export type VirusTotalLocalFile = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sha256: string;
  sha1: string;
  md5: string;
};

export type VirusTotalTargetResult = {
  targetType: 'file' | 'url';
  state: 'found' | 'missing' | 'processing';
  displayName: string;
  identifier: string;
  reportUrl: string;
  analysisId: string | null;
  message: string;
  localFile: VirusTotalLocalFile | null;
  submittedUrl: string | null;
  report: VirusTotalReport | null;
};
