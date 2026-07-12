export type LogCountItem = {
  value: string;
  count: number;
};

export type LogLevels = {
  error: number;
  warning: number;
  info: number;
  debug: number;
  other: number;
};

export type LogAuthSummary = {
  failed: number;
  successful: number;
  invalidUsers: number;
  sudoEvents: number;
};

export type LogTimelineItem = {
  bucket: string;
  count: number;
  errors: number;
  warnings: number;
};

export type LogEventSample = {
  lineNumber: number;
  timestamp: string | null;
  level: string;
  source: string;
  message: string;
  ip: string | null;
  method: string | null;
  statusCode: number | null;
  path: string | null;
};

export type LogAnalysisResult = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  detectedFormat:
    | 'http'
    | 'ssh-auth'
    | 'json-lines'
    | 'generic';

  totalLines: number;
  parsedLines: number;
  malformedLines: number;
  truncated: boolean;

  firstTimestamp: string | null;
  lastTimestamp: string | null;

  levels: LogLevels;
  auth: LogAuthSummary;

  topIps: LogCountItem[];
  topMethods: LogCountItem[];
  topPaths: LogCountItem[];
  topUserAgents: LogCountItem[];
  statusCodes: LogCountItem[];
  topSources: LogCountItem[];

  timeline: LogTimelineItem[];
  eventSamples: LogEventSample[];
};
