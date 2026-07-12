import {
  dialog,
  ipcMain,
  shell,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import {
  getVirusTotalSecretStatus,
  loadVirusTotalApiKey,
  removeVirusTotalApiKey,
  saveVirusTotalApiKey,
} from '../services/virustotal-secret.service';

import type {
  VirusTotalTargetResult,
} from '../../shared/threat-intelligence/threat-intelligence.types';

let selectedFilePath: string | null = null;

function requireText(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `${fieldName} precisa ser um texto.`,
    );
  }

  return value;
}

async function runFileLookup(
  filePath: string,
): Promise<VirusTotalTargetResult> {
  const apiKey =
    await loadVirusTotalApiKey();

  return pythonService.invoke<VirusTotalTargetResult>(
    'threat_intelligence.virustotal_file',
    {
      filePath,
      apiKey,
    },
    90_000,
  );
}

export function registerThreatIntelligenceIpcHandlers():
  void {
  ipcMain.handle(
    'threat-intelligence:virustotal:status',
    async () =>
      getVirusTotalSecretStatus(),
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:save-key',
    async (
      _event,
      rawApiKey: unknown,
    ) =>
      saveVirusTotalApiKey(
        requireText(rawApiKey, 'A chave'),
      ),
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:remove-key',
    async () =>
      removeVirusTotalApiKey(),
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:lookup-file',
    async () => {
      const selection =
        await dialog.showOpenDialog({
          title:
            'Selecione um arquivo para consultar no VirusTotal',
          properties: ['openFile'],
        });

      if (
        selection.canceled ||
        selection.filePaths.length === 0
      ) {
        return null;
      }

      selectedFilePath =
        selection.filePaths[0];

      return runFileLookup(
        selectedFilePath,
      );
    },
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:refresh-file',
    async () => {
      if (!selectedFilePath) {
        throw new Error(
          'Selecione um arquivo primeiro.',
        );
      }

      return runFileLookup(
        selectedFilePath,
      );
    },
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:upload-file',
    async () => {
      if (!selectedFilePath) {
        throw new Error(
          'Selecione um arquivo primeiro.',
        );
      }

      const confirmation =
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Enviar arquivo ao VirusTotal',
          message:
            'O arquivo será enviado para um serviço externo.',
          detail:
            'Não envie documentos privados, senhas, chaves, arquivos pessoais ou conteúdo confidencial.',
          buttons: [
            'Cancelar',
            'Enviar e analisar',
          ],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        });

      if (confirmation.response !== 1) {
        return null;
      }

      const apiKey =
        await loadVirusTotalApiKey();

      return pythonService.invoke<VirusTotalTargetResult>(
        'threat_intelligence.virustotal_file_upload',
        {
          filePath: selectedFilePath,
          apiKey,
        },
        180_000,
      );
    },
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:lookup-url',
    async (
      _event,
      rawUrl: unknown,
    ) => {
      const apiKey =
        await loadVirusTotalApiKey();

      return pythonService.invoke<VirusTotalTargetResult>(
        'threat_intelligence.virustotal_url',
        {
          url: requireText(rawUrl, 'A URL'),
          apiKey,
        },
        90_000,
      );
    },
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:scan-url',
    async (
      _event,
      rawUrl: unknown,
    ) => {
      const apiKey =
        await loadVirusTotalApiKey();

      return pythonService.invoke<VirusTotalTargetResult>(
        'threat_intelligence.virustotal_url_scan',
        {
          url: requireText(rawUrl, 'A URL'),
          apiKey,
        },
        180_000,
      );
    },
  );

  ipcMain.handle(
    'threat-intelligence:virustotal:open-report',
    async (
      _event,
      rawReportUrl: unknown,
    ) => {
      const reportUrl =
        requireText(
          rawReportUrl,
          'A URL do relatório',
        );

      const parsed = new URL(reportUrl);

      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !==
          'www.virustotal.com' ||
        !parsed.pathname.startsWith('/gui/')
      ) {
        throw new Error(
          'A URL do relatório não é permitida.',
        );
      }

      await shell.openExternal(
        parsed.toString(),
      );
    },
  );
}
