import {
  decodeUrlComponent,
  encodeUrlComponent,
} from '../services/url.service';

import {
  TextTransformTool,
} from './TextTransformTool';

export function UrlTool() {
  return (
    <TextTransformTool
      category="ENCODING"
      title="URL Encoder / Decoder"
      description="Codificação percentual para componentes e parâmetros de URLs."
      placeholders={{
        encode:
          'Digite o texto que será codificado...',
        decode:
          'Cole o conteúdo URL encoded...',
      }}
      transform={{
        encode: encodeUrlComponent,
        decode: decodeUrlComponent,
      }}
    />
  );
}
