import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  EncodingMode,
  EncodingTool,
  EncodingTransformRequest,
} from '../../shared/encoding/encoding.types';

const ENCODING_TOOLS:
  readonly EncodingTool[] = [
    'base64',
    'url',
    'hex',
  ];

const ENCODING_MODES:
  readonly EncodingMode[] = [
    'encode',
    'decode',
  ];

const MAX_TEXT_LENGTH =
  2_000_000;

function isEncodingTool(
  value: unknown,
): value is EncodingTool {
  return (
    typeof value === 'string' &&
    ENCODING_TOOLS.includes(
      value as EncodingTool,
    )
  );
}

function isEncodingMode(
  value: unknown,
): value is EncodingMode {
  return (
    typeof value === 'string' &&
    ENCODING_MODES.includes(
      value as EncodingMode,
    )
  );
}

function parseRequest(
  value: unknown,
): EncodingTransformRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação de Encoding é inválida.',
    );
  }

  const request =
    value as
      Partial<EncodingTransformRequest>;

  if (
    !isEncodingTool(
      request.tool,
    )
  ) {
    throw new TypeError(
      'A ferramenta de Encoding é inválida.',
    );
  }

  if (
    !isEncodingMode(
      request.mode,
    )
  ) {
    throw new TypeError(
      'O modo de Encoding é inválido.',
    );
  }

  if (
    typeof request.value !==
    'string'
  ) {
    throw new TypeError(
      'O conteúdo precisa ser um texto.',
    );
  }

  if (
    request.value.length >
    MAX_TEXT_LENGTH
  ) {
    throw new TypeError(
      'O conteúdo excede o limite permitido.',
    );
  }

  return {
    tool: request.tool,
    mode: request.mode,
    value: request.value,
  };
}

export function registerEncodingIpcHandlers():
  void {
  ipcMain.handle(
    'encoding:transform',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseRequest(
          rawRequest,
        );

      return pythonService.invoke<string>(
        'encoding.transform',
        {
          tool: request.tool,
          mode: request.mode,
          value: request.value,
        },
      );
    },
  );
}
