import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  RdapDomainRequest,
  RdapDomainResult,
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
    value as Partial<RdapDomainRequest>;

  if (
    typeof request.domain !==
    'string'
  ) {
    throw new TypeError(
      'O domínio precisa ser um texto.',
    );
  }

  if (
    request.domain.length >
    2048
  ) {
    throw new TypeError(
      'O domínio excede o limite permitido.',
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

      return pythonService.invoke<RdapDomainResult>(
        'osint.rdap_domain',
        {
          domain:
            request.domain,
        },
        30_000,
      );
    },
  );
}
