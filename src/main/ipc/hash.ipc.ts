import {
  dialog,
  ipcMain,
} from 'electron';

import {
  hashFile,
  hashText,
} from '../services/hash.service';

import type {
  HashAlgorithm,
  HashTextRequest,
} from '../../shared/hash/hash.types';

const HASH_ALGORITHMS:
  readonly HashAlgorithm[] = [
    'sha256',
    'sha512',
  ];

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

  if (!isHashAlgorithm(request.algorithm)) {
    throw new TypeError(
      'O algoritmo de hash informado é inválido.',
    );
  }

  if (typeof request.text !== 'string') {
    throw new TypeError(
      'O conteúdo precisa ser um texto.',
    );
  }

  return {
    algorithm: request.algorithm,
    text: request.text,
  };
}

export function registerHashIpcHandlers(): void {
  ipcMain.handle(
    'hash:text',
    (_event, rawRequest: unknown) => {
      const request =
        parseTextRequest(rawRequest);

      return hashText(request);
    },
  );

  ipcMain.handle(
    'hash:file:select',
    async (
      _event,
      rawAlgorithm: unknown,
    ) => {
      if (
        !isHashAlgorithm(rawAlgorithm)
      ) {
        throw new TypeError(
          'O algoritmo de hash informado é inválido.',
        );
      }

      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo para calcular o hash',
          properties: ['openFile'],
        });

      if (
        selection.canceled ||
        selection.filePaths.length === 0
      ) {
        return null;
      }

      return hashFile(
        selection.filePaths[0],
        rawAlgorithm,
      );
    },
  );
}
