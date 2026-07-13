export type AccentColor =
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'green';

export type VisualProfile =
  | 'default'
  | 'monochrome';

export type AppSettings = {
  accentColor: AccentColor;
  visualProfile: VisualProfile;
  compactMode: boolean;
  showRuntimeInfo: boolean;
};
