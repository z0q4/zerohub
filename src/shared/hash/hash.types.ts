export type HashAlgorithm =
  | 'sha256'
  | 'sha512';

export type HashTextRequest = {
  algorithm: HashAlgorithm;
  text: string;
};

export type HashFileResult = {
  algorithm: HashAlgorithm;
  digest: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
};
