import {
  ipcMain,
} from 'electron';

import {
  validatePublicIpAddress,
} from '../../shared/ip-geolocation/ip-address.validation';
import {
  ipGeolocationService,
} from '../services/ip-geolocation.service';

import type {
  IpGeolocationLookupRequest,
  IpGeolocationLookupResponse,
  IpPublicLookupResponse,
} from '../../shared/ip-geolocation/ip-geolocation.types';

type ParsedLookupRequest =
  | {
    ok: true;
    request: IpGeolocationLookupRequest;
  }
  | {
    ok: false;
    response: IpGeolocationLookupResponse;
  };

function invalidLookupResponse(
  code: 'invalid-ip' | 'invalid-response',
  message: string,
): IpGeolocationLookupResponse {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

export function parseRequest(
  value: unknown,
): ParsedLookupRequest {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return {
      ok: false,
      response: invalidLookupResponse(
        'invalid-response',
        'A solicitação de geolocalização é inválida.',
      ),
    };
  }

  const request =
    value as Partial<
      IpGeolocationLookupRequest
    >;

  if (
    typeof request.requestId !==
      'string' ||
    !request.requestId.trim() ||
    request.requestId.length > 128
  ) {
    return {
      ok: false,
      response: invalidLookupResponse(
        'invalid-response',
        'O identificador da consulta é inválido.',
      ),
    };
  }

  if (request.ip === null) {
    return {
      ok: true,
      request: {
        requestId: request.requestId,
        ip: null,
      },
    };
  }

  if (typeof request.ip !== 'string') {
    return {
      ok: false,
      response: invalidLookupResponse(
        'invalid-ip',
        'O endereço IP da consulta é inválido.',
      ),
    };
  }

  const validation =
    validatePublicIpAddress(
      request.ip,
    );

  if (validation.valid === false) {
    return {
      ok: false,
      response: invalidLookupResponse(
        'invalid-ip',
        validation.message,
      ),
    };
  }

  return {
    ok: true,
    request: {
      requestId: request.requestId,
      ip: validation.ip,
    },
  };
}

export function parseRequestId(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 128
  ) {
    return null;
  }

  return value;
}

export function registerIpGeolocationIpcHandlers():
  void {
  ipcMain.handle(
    'ip-geolocation:lookup',
    async (_event, rawRequest: unknown) => {
      const parsed = parseRequest(
        rawRequest,
      );

      if (parsed.ok === false) {
        return parsed.response;
      }

      return ipGeolocationService.lookup(
        parsed.request,
      );
    },
  );

  ipcMain.handle(
    'ip-geolocation:lookup-public',
    async (_event, rawRequestId: unknown) => {
      const requestId = parseRequestId(
        rawRequestId,
      );

      if (!requestId) {
        const response:
          IpPublicLookupResponse = {
            ok: false,
            error: {
              code: 'invalid-response',
              message:
                'O identificador da consulta é inválido.',
            },
          };

        return response;
      }

      return ipGeolocationService
        .lookupPublic({ requestId });
    },
  );

  ipcMain.handle(
    'ip-geolocation:cancel',
    (_event, rawRequestId: unknown) => {
      const requestId = parseRequestId(
        rawRequestId,
      );

      return requestId
        ? ipGeolocationService.cancel(
          requestId,
        )
        : false;
    },
  );
}
