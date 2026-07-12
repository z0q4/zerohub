import {
  dialog,
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  FileForensicsResult,
} from '../../shared/file-forensics/file-forensics.types';

export function registerFileForensicsIpcHandlers():
  void {
  ipcMain.handle(
    'file-forensics:inspect-file',
    async (
      _event,
      rawMinStringLength: unknown,
    ) => {
      const minStringLength =
        typeof rawMinStringLength ===
          'number'
          ? rawMinStringLength
          : 5;

      if (
        !Number.isInteger(
          minStringLength,
        ) ||
        minStringLength < 4 ||
        minStringLength > 64
      ) {
        throw new TypeError(
          'O tamanho mínimo precisa estar entre 4 e 64.',
        );
      }

      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo para análise forense',

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

      return pythonService.invoke<FileForensicsResult>(
        'file_forensics.inspect',
        {
          filePath:
            selection.filePaths[0],

          minStringLength,
        },
        180_000,
      );
    },
  );
}
