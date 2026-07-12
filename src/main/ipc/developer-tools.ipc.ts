import {
  ipcMain,
} from 'electron';

import {
  pythonService,
} from '../python/python.service';

import type {
  DiffResult,
  JsonFormatResult,
  RegexTestResult,
  TextConvertResult,
  TimestampConvertResult,
  UuidGenerateResult,
} from '../../shared/developer-tools/developer-tools.types';

function requireString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== 'string'
  ) {
    throw new TypeError(
      `${field} precisa ser um texto.`,
    );
  }

  return value;
}

function requireInteger(
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

function requireBoolean(
  value: unknown,
  field: string,
): boolean {
  if (
    typeof value !== 'boolean'
  ) {
    throw new TypeError(
      `${field} precisa ser booleano.`,
    );
  }

  return value;
}

export function registerDeveloperToolsIpcHandlers():
  void {
  ipcMain.handle(
    'developer-tools:json',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          text?: unknown;
          indent?: unknown;
          sortKeys?: unknown;
          minify?: unknown;
        };

      return pythonService.invoke<JsonFormatResult>(
        'developer_tools.json',
        {
          text:
            requireString(
              request.text,
              'O JSON',
            ),

          indent:
            requireInteger(
              request.indent,
              'A indentação',
            ),

          sortKeys:
            requireBoolean(
              request.sortKeys,
              'A opção sortKeys',
            ),

          minify:
            requireBoolean(
              request.minify,
              'A opção minify',
            ),
        },
      );
    },
  );

  ipcMain.handle(
    'developer-tools:yaml',
    async (
      _event,
      rawText: unknown,
      rawDirection: unknown,
    ) =>
      pythonService.invoke<TextConvertResult>(
        'developer_tools.yaml',
        {
          text:
            requireString(
              rawText,
              'O conteúdo',
            ),

          direction:
            requireString(
              rawDirection,
              'A direção',
            ),
        },
      ),
  );

  ipcMain.handle(
    'developer-tools:toml',
    async (
      _event,
      rawText: unknown,
      rawDirection: unknown,
    ) =>
      pythonService.invoke<TextConvertResult>(
        'developer_tools.toml',
        {
          text:
            requireString(
              rawText,
              'O conteúdo',
            ),

          direction:
            requireString(
              rawDirection,
              'A direção',
            ),
        },
      ),
  );

  ipcMain.handle(
    'developer-tools:regex',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          pattern?: unknown;
          text?: unknown;
          flags?: unknown;
          replacement?: unknown;
        };

      return pythonService.invoke<RegexTestResult>(
        'developer_tools.regex',
        {
          pattern:
            requireString(
              request.pattern,
              'A expressão',
            ),

          text:
            requireString(
              request.text,
              'O texto',
            ),

          flags:
            requireString(
              request.flags,
              'As flags',
            ),

          replacement:
            requireString(
              request.replacement,
              'A substituição',
            ),
        },
      );
    },
  );

  ipcMain.handle(
    'developer-tools:uuid',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          version?: unknown;
          count?: unknown;
          namespace?: unknown;
          name?: unknown;
        };

      return pythonService.invoke<UuidGenerateResult>(
        'developer_tools.uuid',
        {
          version:
            requireString(
              request.version,
              'A versão',
            ),

          count:
            requireInteger(
              request.count,
              'A quantidade',
            ),

          namespace:
            requireString(
              request.namespace,
              'O namespace',
            ),

          name:
            requireString(
              request.name,
              'O nome',
            ),
        },
      );
    },
  );

  ipcMain.handle(
    'developer-tools:timestamp',
    async (
      _event,
      rawValue: unknown,
    ) =>
      pythonService.invoke<TimestampConvertResult>(
        'developer_tools.timestamp',
        {
          value:
            requireString(
              rawValue,
              'O timestamp',
            ),
        },
      ),
  );

  ipcMain.handle(
    'developer-tools:diff',
    async (
      _event,
      rawRequest: unknown,
    ) => {
      const request =
        rawRequest as {
          left?: unknown;
          right?: unknown;
          leftLabel?: unknown;
          rightLabel?: unknown;
        };

      return pythonService.invoke<DiffResult>(
        'developer_tools.diff',
        {
          left:
            requireString(
              request.left,
              'O texto anterior',
            ),

          right:
            requireString(
              request.right,
              'O texto novo',
            ),

          leftLabel:
            requireString(
              request.leftLabel,
              'O nome anterior',
            ),

          rightLabel:
            requireString(
              request.rightLabel,
              'O nome novo',
            ),
        },
      );
    },
  );
}
