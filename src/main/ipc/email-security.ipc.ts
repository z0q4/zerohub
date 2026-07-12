import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  EmailSecurityResult,
} from '../../shared/email-security/email-security.types';

export function registerEmailSecurityIpcHandlers():
  void {
  ipcMain.handle(
    'email-security:inspect',
    async (
      _event,
      rawDomain: unknown,
      rawSelector: unknown,
    ) => {
      if (
        typeof rawDomain !== 'string'
      ) {
        throw new TypeError(
          'O domínio precisa ser um texto.',
        );
      }

      if (
        typeof rawSelector !== 'string'
      ) {
        throw new TypeError(
          'O seletor precisa ser um texto.',
        );
      }

      return pythonService.invoke<EmailSecurityResult>(
        'email_security.inspect',
        {
          domain: rawDomain,
          selector: rawSelector,
        },
        120_000,
      );
    },
  );
}
