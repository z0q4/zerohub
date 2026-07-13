export type AccentColor =
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'green';

export type AppSettings = {
  accentColor: AccentColor;
  compactMode: boolean;
  saveSessionOnClose: boolean;
  showRuntimeInfo: boolean;
};
