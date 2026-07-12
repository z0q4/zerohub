export type JsonFormatResult = {
  valid: true;
  output: string;
  rootType: string;
  characterCount: number;
};

export type TextConvertResult = {
  direction: string;
  output: string;
};

export type RegexMatchResult = {
  index: number;
  match: string;
  start: number;
  end: number;
  groups: Array<string | null>;
  groupDict: Record<
    string,
    string | null
  >;
};

export type RegexTestResult = {
  valid: true;
  flags: string;
  matchCount: number;
  truncated: boolean;
  elapsedMs: number;
  matches: RegexMatchResult[];
  replaced: string | null;
};

export type UuidGenerateResult = {
  version: string;
  count: number;
  values: string[];
};

export type TimestampConvertResult = {
  input: string;
  unixSeconds: number;
  unixMilliseconds: number;
  isoUtc: string;
  isoLocal: string;
  rfc2822: string;
  dateUtc: string;
  timeUtc: string;
  timezoneLocal: string;
};

export type DiffChange = {
  type:
    | 'replace'
    | 'delete'
    | 'insert';

  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
  leftLines: string[];
  rightLines: string[];
};

export type DiffResult = {
  identical: boolean;
  addedLines: number;
  removedLines: number;
  replacementBlocks: number;
  changeBlocks: number;
  similarity: number;
  unifiedDiff: string;
  changes: DiffChange[];
};
