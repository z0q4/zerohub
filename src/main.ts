import {
  app,
  BrowserWindow,
} from 'electron';

import path from 'node:path';

import started from 'electron-squirrel-startup';

import {
  registerHashIpcHandlers,
} from './main/ipc/hash.ipc';

import {
  registerNetworkIpcHandlers,
} from './main/ipc/network.ipc';

import {
  registerOsintIpcHandlers,
} from './main/ipc/osint.ipc';

import {
  registerSettingsIpcHandlers,
} from './main/ipc/settings.ipc';

if (started) {
  app.quit();
}

function createWindow(): void {
  const mainWindow =
    new BrowserWindow({
      title: 'ZeroHub',
      width: 1280,
      height: 820,
      minWidth: 980,
      minHeight: 650,
      backgroundColor: '#080a0f',
      show: false,

      webPreferences: {
        preload: path.join(
          __dirname,
          'preload.js',
        ),

        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

  mainWindow.once(
    'ready-to-show',
    () => {
      mainWindow.show();
    },
  );

  if (
    MAIN_WINDOW_VITE_DEV_SERVER_URL
  ) {
    void mainWindow.loadURL(
      MAIN_WINDOW_VITE_DEV_SERVER_URL,
    );
  } else {
    void mainWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
      ),
    );
  }
}

app.whenReady().then(() => {
  registerHashIpcHandlers();
  registerNetworkIpcHandlers();
  registerOsintIpcHandlers();
  registerSettingsIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (
      BrowserWindow
        .getAllWindows()
        .length === 0
    ) {
      createWindow();
    }
  });
});

app.on(
  'window-all-closed',
  () => {
    if (
      process.platform !==
      'darwin'
    ) {
      app.quit();
    }
  },
);
