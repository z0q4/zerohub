export type EncodingTool =
  | 'base64'
  | 'url'
  | 'hex';

export type EncodingMode =
  | 'encode'
  | 'decode';

export type EncodingTransformRequest = {
  tool: EncodingTool;
  mode: EncodingMode;
  value: string;
};
