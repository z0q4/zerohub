export type ForensicString = {
  value: string;
  encoding: 'ASCII' | 'UTF-16LE';
  offset: number;
};

export type ForensicStringStats = {
  total: number;
  asciiCount: number;
  utf16Count: number;
  truncated: boolean;
  limit: number;
  minLength: number;
};

export type ForensicIndicators = {
  urls: string[];
  emails: string[];
  ipv4: string[];
  domains: string[];
  hashes: string[];
};

export type ArchiveEntry = {
  name: string;
  sizeBytes: number;
  compressedSizeBytes: number;
  isDirectory: boolean;
  encrypted: boolean;
  crc32: string;
};

export type ArchiveInspection = {
  type: string;
  error?: string;
  entryCount: number;
  displayedEntries: number;
  truncated: boolean;
  totalUncompressedBytes: number;
  totalCompressedBytes: number;
  encryptedEntries: number;
  entries: ArchiveEntry[];
};

export type FileForensicsResult = {
  fileName: string;
  filePath: string;
  extension: string | null;
  sizeBytes: number;
  mimeType: string;
  formatName: string;
  entropy: number;
  sha256: string;
  sha1: string;
  md5: string;
  modifiedAt: string;
  formatDetails: Record<string, unknown>;
  stringStats: ForensicStringStats;
  strings: ForensicString[];
  indicators: ForensicIndicators;
  archive: ArchiveInspection | null;
};
