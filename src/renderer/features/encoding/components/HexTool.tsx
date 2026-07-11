import {
  TextTransformTool,
} from './TextTransformTool';

export function HexTool() {
  return (
    <TextTransformTool
      category="ENCODING · PYTHON"
      title="Hexadecimal"
      description="Conversão entre texto UTF-8 e hexadecimal utilizando o módulo Python."
      placeholders={{
        encode:
          'Digite o texto que será convertido para hexadecimal...',

        decode:
          'Cole uma sequência hexadecimal, com ou sem espaços...',
      }}
      transform={{
        encode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'hex',
              mode: 'encode',
              value,
            }),

        decode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'hex',
              mode: 'decode',
              value,
            }),
      }}
    />
  );
}
