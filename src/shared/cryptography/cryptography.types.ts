export type CryptoAlgorithm =
  | 'sha256'
  | 'sha512';

export type CryptoEncoding =
  | 'hex'
  | 'base64';

export type HmacResult = {
  algorithm: CryptoAlgorithm;
  encoding: CryptoEncoding;
  digest: string;
  bytes: number;
};

export type HmacVerifyResult = {
  valid: boolean;
  calculatedHex: string;
  calculatedBase64: string;
};

export type Pbkdf2Result = {
  algorithm: CryptoAlgorithm;
  iterations: number;
  length: number;
  saltGenerated: boolean;
  saltHex: string;
  saltBase64: string;
  derivedKeyHex: string;
  derivedKeyBase64: string;
};

export type RandomFormat =
  | 'password'
  | 'hex'
  | 'base64url';

export type RandomRequest = {
  format: RandomFormat;
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
};

export type RandomResult = {
  format: RandomFormat;
  length: number;
  value: string;
  alphabetSize: number | null;
};

export type JwtResult = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signatureHex: string;
  signatureLength: number;
  algorithm: string | null;
  expired: boolean;

  timeline: {
    issuedAt: string | null;
    notBefore: string | null;
    expiresAt: string | null;
  };

  signatureVerified: false;
  warning: string;
};

export type CompareResult = {
  equal: boolean;
  leftLength: number;
  rightLength: number;
};
