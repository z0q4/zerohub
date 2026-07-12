import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  CompareResult,
  HmacResult,
  HmacVerifyResult,
  JwtResult,
  Pbkdf2Result,
  RandomRequest,
  RandomResult,
} from '../../shared/cryptography/cryptography.types';

function requireObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'A solicitação é inválida.',
    );
  }

  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  field: string,
): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `${field} precisa ser um texto.`,
    );
  }

  return value;
}

function integer(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value)
  ) {
    throw new TypeError(
      `${field} precisa ser um inteiro.`,
    );
  }

  return value;
}

export function registerCryptographyIpcHandlers():
  void {
  ipcMain.handle(
    'cryptography:hmac-create',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        requireObject(rawRequest);

      return pythonService.invoke<HmacResult>(
        'cryptography.hmac_create',
        {
          key: text(
            request.key,
            'A chave',
          ),

          message: text(
            request.message,
            'A mensagem',
          ),

          algorithm: text(
            request.algorithm,
            'O algoritmo',
          ),

          encoding: text(
            request.encoding,
            'A codificação',
          ),
        },
      );
    },
  );

  ipcMain.handle(
    'cryptography:hmac-verify',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        requireObject(rawRequest);

      return pythonService.invoke<HmacVerifyResult>(
        'cryptography.hmac_verify',
        {
          key: text(
            request.key,
            'A chave',
          ),

          message: text(
            request.message,
            'A mensagem',
          ),

          expected: text(
            request.expected,
            'O HMAC esperado',
          ),

          algorithm: text(
            request.algorithm,
            'O algoritmo',
          ),

          encoding: text(
            request.encoding,
            'A codificação',
          ),
        },
      );
    },
  );

  ipcMain.handle(
    'cryptography:pbkdf2',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        requireObject(rawRequest);

      return pythonService.invoke<Pbkdf2Result>(
        'cryptography.pbkdf2',
        {
          password: text(
            request.password,
            'A senha',
          ),

          salt: text(
            request.salt,
            'O salt',
          ),

          algorithm: text(
            request.algorithm,
            'O algoritmo',
          ),

          iterations: integer(
            request.iterations,
            'As iterações',
          ),

          length: integer(
            request.length,
            'O tamanho',
          ),
        },
      );
    },
  );

  ipcMain.handle(
    'cryptography:random',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        requireObject(rawRequest);

      return pythonService.invoke<RandomResult>(
        'cryptography.random',
        {
          format: text(
            request.format,
            'O formato',
          ),

          length: integer(
            request.length,
            'O tamanho',
          ),

          lower: request.lower,
          upper: request.upper,
          digits: request.digits,
          symbols: request.symbols,
        },
      );
    },
  );

  ipcMain.handle(
    'cryptography:jwt',
    async (
      _event,
      rawToken: unknown,
    ) =>
      pythonService.invoke<JwtResult>(
        'cryptography.jwt_decode',
        {
          token: text(
            rawToken,
            'O JWT',
          ),
        },
      ),
  );

  ipcMain.handle(
    'cryptography:compare',
    async (
      _event,
      rawLeft: unknown,
      rawRight: unknown,
    ) =>
      pythonService.invoke<CompareResult>(
        'cryptography.compare',
        {
          left: text(
            rawLeft,
            'O primeiro valor',
          ),

          right: text(
            rawRight,
            'O segundo valor',
          ),
        },
      ),
  );
}
