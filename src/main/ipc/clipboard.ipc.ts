import {
  clipboard,
  ipcMain,
} from 'electron';

const MAX_CLIPBOARD_TEXT_LENGTH =
  1024 * 1024;

export function parseClipboardText(
  value: unknown,
): string {
  if (
    typeof value !== 'string' ||
    value.length >
      MAX_CLIPBOARD_TEXT_LENGTH
  ) {
    throw new TypeError(
      'O conteúdo do clipboard é inválido.',
    );
  }

  return value;
}

export function registerClipboardIpcHandlers():
  void {
  ipcMain.handle(
    'clipboard:write-text',
    (_event, rawText: unknown) => {
      clipboard.writeText(
        parseClipboardText(rawText),
      );
    },
  );
}
