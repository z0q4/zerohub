import {
  ipcMain,
} from 'electron';

import {
  loadSettings,
  saveSettings,
} from '../services/settings.service';

export function registerSettingsIpcHandlers():
  void {
  ipcMain.handle(
    'settings:get',
    async () =>
      loadSettings(),
  );

  ipcMain.handle(
    'settings:save',
    async (
      _event,
      rawSettings: unknown,
    ) =>
      saveSettings(
        rawSettings,
      ),
  );
}
