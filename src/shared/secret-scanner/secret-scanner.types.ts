export type SecretSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type SecretScannerFinding = {
  id: string;
  ruleId: string;
  category: string;
  severity: SecretSeverity;
  filePath: string;
  relativePath: string;
  line: number;
  column: number;
  maskedValue: string;
  fingerprint: string;
  redactedContext: string;
  description: string;
  remediation: string;
  exampleOrTestFile: boolean;
};

export type SecretScannerResult = {
  targetType: 'file' | 'folder';
  targetPath: string;
  scannedFiles: number;
  skippedFiles: number;
  totalBytes: number;
  durationMs: number;
  truncated: boolean;
  limits: {
    maxFiles: number;
    maxFindings: number;
    maxFileBytes: number;
    maxTotalBytes: number;
  };
  ignoredDirectories: string[];
  skipReasons: Record<string, number>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: SecretScannerFinding[];
};
