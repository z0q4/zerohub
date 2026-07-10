import {
  decodeHexUtf8,
  encodeHexUtf8,
} from '../services/hex.service';

import {
  TextTransformTool,
} from './TextTransformTool';

export function HexTool() {
  return (
    <TextTransformTool
      category="ENCODING"
      title="Hexadecimal"
      description="Converta textos UTF-8 para hexadecimal e faça a operação inversa."
      placeholders={{
        encode:
          'Digite o texto que será convertido para hexadecimal...',
        decode:
          'Cole uma sequência hexadecimal, com ou sem espaços...',
      }}
      transform={{
        encode: encodeHexUtf8,
        decode: decodeHexUtf8,
      }}
    />
  );
}
