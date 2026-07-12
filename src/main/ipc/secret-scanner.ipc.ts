import { dialog, ipcMain } from 'electron';
import { pythonService } from '../python/python.service';
import type { SecretScannerResult } from '../../shared/secret-scanner/secret-scanner.types';

export function registerSecretScannerIpcHandlers(): void {
  ipcMain.handle('secret-scanner:scan-file', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Selecione um arquivo para verificar',
      properties: ['openFile'],
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    return pythonService.invoke<SecretScannerResult>(
      'secret_scanner.scan_file',
      { filePath: selection.filePaths[0] },
      180_000,
    );
  });

  ipcMain.handle('secret-scanner:scan-folder', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Selecione uma pasta ou projeto para verificar',
      properties: ['openDirectory'],
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    return pythonService.invoke<SecretScannerResult>(
      'secret_scanner.scan_folder',
      { folderPath: selection.filePaths[0] },
      300_000,
    );
  });
}
