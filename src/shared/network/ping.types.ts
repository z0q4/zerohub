export type PingRequest = {
  target: string;
  count: number;
  timeoutMs: number;
};

export type PingResult = {
  target: string;
  output: string;
  success: boolean;
  timedOut: boolean;
  exitCode: number | null;
  elapsedMs: number;
};
