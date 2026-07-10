import {
  decodeBase64Utf8,
  encodeBase64Utf8,
} from '../services/base64.service';

import {
  TextTransformTool,
} from './TextTransformTool';

export function Base64Tool() {
  return (
    <TextTransformTool
      category="ENCODING"
      title="Base64"
      description="Codifique e decodifique textos UTF-8 localmente."
      placeholders={{
        encode:
          'Digite o texto que será codificado...',
        decode:
          'Cole o conteúdo Base64 que será decodificado...',
      }}
      transform={{
        encode: encodeBase64Utf8,
        decode: decodeBase64Utf8,
      }}
    />
  );
}
