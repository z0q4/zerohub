import {
  TextTransformTool,
} from './TextTransformTool';

export function UrlTool() {
  return (
    <TextTransformTool
      category="ENCODING · PYTHON"
      title="URL Encoder / Decoder"
      description="Codificação percentual de componentes de URL processada pelo módulo Python."
      placeholders={{
        encode:
          'Digite o texto que será codificado...',

        decode:
          'Cole o conteúdo URL encoded...',
      }}
      transform={{
        encode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'url',
              mode: 'encode',
              value,
            }),

        decode: (
          value,
        ) =>
          window.zeroHub
            .encoding
            .transform({
              tool: 'url',
              mode: 'decode',
              value,
            }),
      }}
    />
  );
}
