import {
  app,
} from 'electron';

import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
  join,
} from 'node:path';

import {
  ACCENT_COLORS,
  DEFAULT_APP_SETTINGS,
} from '../../shared/settings/settings.defaults';

import type {
  AccentColor,
  AppSettings,
} from '../../shared/settings/settings.types';

function isAccentColor(
  value: unknown,
): value is AccentColor {
  return (
    typeof value === 'string' &&
    ACCENT_COLORS.includes(
      value as AccentColor,
    )
  );
}

function normalizeSettings(
  value: unknown,
): AppSettings {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return {
      ...DEFAULT_APP_SETTINGS,
    };
  }

  const candidate =
    value as Partial<AppSettings>;

  return {
    accentColor:
      isAccentColor(
        candidate.accentColor,
      )
        ? candidate.accentColor
        : DEFAULT_APP_SETTINGS
            .accentColor,

    compactMode:
      typeof candidate.compactMode ===
      'boolean'
        ? candidate.compactMode
        : DEFAULT_APP_SETTINGS
            .compactMode,

    showRuntimeInfo:
      typeof candidate
        .showRuntimeInfo ===
      'boolean'
        ? candidate.showRuntimeInfo
        : DEFAULT_APP_SETTINGS
            .showRuntimeInfo,
  };
}

function getSettingsPath(): string {
  return join(
    app.getPath('userData'),
    'settings.json',
  );
}

export async function loadSettings():
  Promise<AppSettings> {
  const settingsPath =
    getSettingsPath();

  try {
    const rawContent =
      await readFile(
        settingsPath,
        'utf8',
      );

    const parsedContent:
      unknown =
      JSON.parse(rawContent);

    return normalizeSettings(
      parsedContent,
    );
  } catch (unknownError) {
    const error =
      unknownError as
        NodeJS.ErrnoException;

    if (
      error.code === 'ENOENT' ||
      unknownError instanceof
        SyntaxError
    ) {
      return {
        ...DEFAULT_APP_SETTINGS,
      };
    }

    throw new Error(
      `Não foi possível carregar as configurações: ${error.message}`,
    );
  }
}

export async function saveSettings(
  rawSettings: unknown,
): Promise<AppSettings> {
  const settings =
    normalizeSettings(
      rawSettings,
    );

  const settingsPath =
    getSettingsPath();

  const temporaryPath =
    `${settingsPath}.tmp`;

  await mkdir(
    dirname(settingsPath),
    {
      recursive: true,
    },
  );

  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      settings,
      null,
      2,
    )}\n`,
    'utf8',
  );

  await rm(
    settingsPath,
    {
      force: true,
    },
  );

  await rename(
    temporaryPath,
    settingsPath,
  );

  return settings;
}
