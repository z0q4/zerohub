import {
  ipcMain,
} from 'electron';

import {
  lookupRdapDomain,
} from '../services/rdap.service';

import type {
  RdapDomainRequest,
} from '../../shared/osint/rdap.types';

function parseRequest(
  value: unknown,
): RdapDomainRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação RDAP é inválida.',
    );
  }

  const request =
    value as
      Partial<RdapDomainRequest>;

  if (
    typeof request.domain !==
    'string'
  ) {
    throw new TypeError(
      'O domínio precisa ser um texto.',
    );
  }

  return {
    domain:
      request.domain,
  };
}

export function registerOsintIpcHandlers():
  void {
  ipcMain.handle(
    'osint:rdap:domain',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        parseRequest(
          rawRequest,
        );

      return lookupRdapDomain(
        request.domain,
      );
    },
  );
}
