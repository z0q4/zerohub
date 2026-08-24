import {
  ipcMain,
} from 'electron';

import {
  validateCredentialsInput,
  validateSetupInput,
  validateUnlockInput,
  validateUnlockSetupInput,
} from '../../shared/auth/auth.validation';

import {
  getAuthStatus,
  lockAuth,
  loginAuth,
  setupAuth,
  setupUnlockAuth,
  unlockAuth,
} from '../services/auth.service';

export function registerAuthIpcHandlers():
  void {
  ipcMain.handle(
    'auth:status',
    async () => getAuthStatus(),
  );

  ipcMain.handle(
    'auth:setup',
    async (_event, input: unknown) =>
      setupAuth(
        validateSetupInput(input),
      ),
  );

  ipcMain.handle(
    'auth:login',
    async (_event, input: unknown) =>
      loginAuth(
        validateCredentialsInput(
          input,
        ),
      ),
  );

  ipcMain.handle(
    'auth:setup-unlock',
    async (_event, input: unknown) =>
      setupUnlockAuth(
        validateUnlockSetupInput(
          input,
        ),
      ),
  );

  ipcMain.handle(
    'auth:unlock',
    async (_event, input: unknown) =>
      unlockAuth(
        validateUnlockInput(input),
      ),
  );

  ipcMain.handle(
    'auth:lock',
    async (event) => {
      const status = await lockAuth();

      if (!event.sender.isDestroyed()) {
        event.sender.send(
          'auth:locked',
          status,
        );
      }

      return status;
    },
  );
}
