export type FileKind =
  | 'text'
  | 'binary';

export type FileAnalysisResult = {
  fileName: string;
  filePath: string;
  extension: string | null;
  sizeBytes: number;
  mimeType: string;
  kind: FileKind;
  encoding: string | null;
  lineCount: number | null;
  entropy: number;
  magicHex: string;
  sha256: string;
  sha512: string;
  permissions: string;
  permissionsOctal: string;
  isExecutable: boolean;
  createdAt: string | null;
  modifiedAt: string;
  changedAt: string;
};
