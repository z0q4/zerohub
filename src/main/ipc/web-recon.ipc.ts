import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  WebReconResult,
} from '../../shared/web-recon/web-recon.types';

export function registerWebReconIpcHandlers():
  void {
  ipcMain.handle(
    'web-recon:inspect',
    async (
      _event,
      rawUrl: unknown,
    ) => {
      if (
        typeof rawUrl !== 'string'
      ) {
        throw new TypeError(
          'A URL precisa ser um texto.',
        );
      }

      return pythonService.invoke<WebReconResult>(
        'web_recon.inspect',
        {
          url: rawUrl,
        },
        180_000,
      );
    },
  );
}
