import {
  dialog,
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  FileAnalysisResult,
} from '../../shared/file-analysis/file-analysis.types';

export function registerFileAnalysisIpcHandlers():
  void {
  ipcMain.handle(
    'file-analysis:inspect-file',
    async () => {
      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo para analisar',

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

      return pythonService.invoke<FileAnalysisResult>(
        'file_analysis.inspect',
        {
          filePath:
            selection.filePaths[0],
        },
        120_000,
      );
    },
  );
}
