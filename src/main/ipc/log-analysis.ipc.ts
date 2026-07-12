import {
  dialog,
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  LogAnalysisResult,
} from '../../shared/log-analysis/log-analysis.types';

export function registerLogAnalysisIpcHandlers():
  void {
  ipcMain.handle(
    'log-analysis:inspect-file',
    async () => {
      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo de log',

          properties: [
            'openFile',
          ],

          filters: [
            {
              name: 'Logs e texto',
              extensions: [
                'log',
                'txt',
                'json',
                'jsonl',
                'ndjson',
              ],
            },
            {
              name: 'Todos os arquivos',
              extensions: [
                '*',
              ],
            },
          ],
        });

      if (
        selection.canceled ||
        selection.filePaths.length === 0
      ) {
        return null;
      }

      return pythonService.invoke<LogAnalysisResult>(
        'log_analysis.inspect',
        {
          filePath:
            selection.filePaths[0],
        },
        180_000,
      );
    },
  );
}
