import type {
  AccentColor,
  AppSettings,
  VisualProfile,
} from './settings.types';

export const ACCENT_COLORS:
  readonly AccentColor[] = [
    'red',
    'violet',
    'cyan',
    'green',
  ];

export const VISUAL_PROFILES:
  readonly VisualProfile[] = [
    'default',
    'monochrome',
  ];

export const DEFAULT_APP_SETTINGS:
  AppSettings = {
    accentColor: 'red',
    visualProfile: 'default',
    compactMode: false,
    saveSessionOnClose: true,
    showRuntimeInfo: true,
  };
