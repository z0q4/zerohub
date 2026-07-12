import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  SystemAuditResult,
} from '../../shared/system-audit/system-audit.types';

export function registerSystemAuditIpcHandlers():
  void {
  ipcMain.handle(
    'system-audit:run',
    async () =>
      pythonService.invoke<SystemAuditResult>(
        'system_audit.run',
        {},
        120_000,
      ),
  );
}
