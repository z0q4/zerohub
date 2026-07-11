import {
  TextTransformTool,
} from './TextTransformTool';

export function Base64Tool() {
  return (
    <TextTransformTool
      category="ENCODING · PYTHON"
      title="Base64"
      description="Codifique e decodifique textos UTF-8 utilizando o módulo Python."
      placeholders={{
        encode:
          'Digite o texto que será codificado...',

        decode:
          'Cole o conteúdo Base64 que será decodificado...',
      }}
      transform={{
        encode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'base64',
              mode: 'encode',
              value,
            }),

        decode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'base64',
              mode: 'decode',
              value,
            }),
      }}
    />
  );
}
