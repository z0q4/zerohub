import {
  dialog,
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  FileCrackRequest,
  FileCrackResult,
} from '../../shared/file-cracker/file-cracker.types';

function parseRequest(
  value: unknown,
): FileCrackRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação de crack do ZIP é inválida.',
    );
  }

  const request =
    value as Partial<FileCrackRequest>;

  if (
    typeof request.zipPath !==
    'string' ||
    !request.zipPath.trim()
  ) {
    throw new TypeError(
      'Selecione um arquivo ZIP válido.',
    );
  }

  if (
    request.mode !== 'bruteforce' &&
    request.mode !== 'wordlist'
  ) {
    throw new TypeError(
      'O modo de ataque é inválido.',
    );
  }

  if (
    request.mode === 'wordlist' &&
    (typeof request.wordlistPath !== 'string' ||
      !request.wordlistPath.trim())
  ) {
    throw new TypeError(
      'Selecione um arquivo de wordlist para o modo wordlist.',
    );
  }

  return {
    zipPath:
      request.zipPath,
    mode:
      request.mode,
    wordlistPath:
      request.wordlistPath,
    length:
      request.length,
    useLetters:
      request.useLetters,
    useNumbers:
      request.useNumbers,
    useSpecial:
      request.useSpecial,
  };
}

async function selectFile(
  title: string,
  extensions: string[],
): Promise<string | null> {
  const selection =
    await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: [
        {
          name: 'Arquivos',
          extensions,
        },
      ],
    });

  if (
    selection.canceled ||
    selection.filePaths.length === 0
  ) {
    return null;
  }

  return selection.filePaths[0];
}

export function registerFileCrackerIpcHandlers(): void {
  ipcMain.handle(
    'file-cracker:select-zip',
    async () =>
      selectFile(
        'Selecione um arquivo ZIP',
        ['zip'],
      ),
  );

  ipcMain.handle(
    'file-cracker:select-wordlist',
    async () =>
      selectFile(
        'Selecione uma wordlist',
        ['txt', 'lst', 'dict', 'wordlist'],
      ),
  );

  ipcMain.handle(
    'file-cracker:crack',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseRequest(rawRequest);

      return pythonService.invoke<FileCrackResult>(
        'file_cracker.crack_zip',
        {
          zipPath:
            request.zipPath,
          mode:
            request.mode,
          wordlistPath:
            request.wordlistPath,
          length:
            request.length,
          useLetters:
            request.useLetters,
          useNumbers:
            request.useNumbers,
          useSpecial:
            request.useSpecial,
        },
        180_000,
      );
    },
  );
}
