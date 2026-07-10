import type {
  AccentColor,
  AppSettings,
} from './settings.types';

export const ACCENT_COLORS:
  readonly AccentColor[] = [
    'blue',
    'violet',
    'cyan',
    'green',
  ];

export const DEFAULT_APP_SETTINGS:
  AppSettings = {
    accentColor: 'blue',
    compactMode: false,
    showRuntimeInfo: true,
  };
