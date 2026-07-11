import {
  dialog,
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  HashAlgorithm,
  HashFileResult,
  HashTextRequest,
} from '../../shared/hash/hash.types';

const HASH_ALGORITHMS:
  readonly HashAlgorithm[] = [
    'sha256',
    'sha512',
  ];

const MAX_TEXT_LENGTH =
  2_000_000;

function isHashAlgorithm(
  value: unknown,
): value is HashAlgorithm {
  return (
    typeof value === 'string' &&
    HASH_ALGORITHMS.includes(
      value as HashAlgorithm,
    )
  );
}

function parseTextRequest(
  value: unknown,
): HashTextRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação de hash é inválida.',
    );
  }

  const request =
    value as Partial<HashTextRequest>;

  if (
    !isHashAlgorithm(
      request.algorithm,
    )
  ) {
    throw new TypeError(
      'O algoritmo de hash informado é inválido.',
    );
  }

  if (
    typeof request.text !==
    'string'
  ) {
    throw new TypeError(
      'O conteúdo precisa ser um texto.',
    );
  }

  if (
    request.text.length >
    MAX_TEXT_LENGTH
  ) {
    throw new TypeError(
      'O texto excede o limite permitido.',
    );
  }

  return {
    algorithm:
      request.algorithm,

    text:
      request.text,
  };
}

export function registerHashIpcHandlers():
  void {
  ipcMain.handle(
    'hash:text',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseTextRequest(
          rawRequest,
        );

      return pythonService.invoke<string>(
        'hash.text',
        {
          algorithm:
            request.algorithm,

          text:
            request.text,
        },
      );
    },
  );

  ipcMain.handle(
    'hash:file:select',
    async (
      _event,
      rawAlgorithm: unknown,
    ) => {
      if (
        !isHashAlgorithm(
          rawAlgorithm,
        )
      ) {
        throw new TypeError(
          'O algoritmo de hash informado é inválido.',
        );
      }

      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo para calcular o hash',

          properties: [
            'openFile',
          ],
        });

      if (
        selection.canceled ||
        selection.filePaths.length === 0
      ) {
        return null;
      }

      return pythonService.invoke<HashFileResult>(
        'hash.file',
        {
          algorithm:
            rawAlgorithm,

          filePath:
            selection.filePaths[0],
        },
      );
    },
  );
}
