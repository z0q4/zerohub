import {
  registerCasesIpcHandlers,
} from './main/ipc/cases.ipc';

import {
  registerIocIntelligenceIpcHandlers,
} from './main/ipc/ioc-intelligence.ipc';

import {
  registerDeveloperToolsIpcHandlers,
} from './main/ipc/developer-tools.ipc';

import {
  registerNetworkToolkitIpcHandlers,
} from './main/ipc/network-toolkit.ipc';

import {
  registerEmailSecurityIpcHandlers,
} from './main/ipc/email-security.ipc';

import {
  registerWebReconIpcHandlers,
} from './main/ipc/web-recon.ipc';

import {
  registerCryptographyIpcHandlers,
} from './main/ipc/cryptography.ipc';

import {
  registerSystemAuditIpcHandlers,
} from './main/ipc/system-audit.ipc';

import {
  registerLogAnalysisIpcHandlers,
} from './main/ipc/log-analysis.ipc';

import {
  registerFileForensicsIpcHandlers,
} from './main/ipc/file-forensics.ipc';

import {
  app,
  BrowserWindow,
} from 'electron';

import path from 'node:path';

import started from 'electron-squirrel-startup';

import {
  registerEncodingIpcHandlers,
} from './main/ipc/encoding.ipc';

import {
  registerFileAnalysisIpcHandlers,
} from './main/ipc/file-analysis.ipc';

import {
  registerFileCrackerIpcHandlers,
} from './main/ipc/file-cracker.ipc';

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

import {
  registerSecretScannerIpcHandlers,
} from './main/ipc/secret-scanner.ipc';

import {
  registerThreatIntelligenceIpcHandlers,
} from './main/ipc/threat-intelligence.ipc';

import {
  pythonService,
} from './main/python/python.service';

import {
  clearSessionOnExitIfDisabled,
} from './main/services/session.service';

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
  registerEncodingIpcHandlers();
  registerIocIntelligenceIpcHandlers();
  registerDeveloperToolsIpcHandlers();
  registerNetworkToolkitIpcHandlers();
  registerEmailSecurityIpcHandlers();
  registerWebReconIpcHandlers();
  registerCryptographyIpcHandlers();
  registerSystemAuditIpcHandlers();
  registerFileAnalysisIpcHandlers();
  registerFileForensicsIpcHandlers();
  registerLogAnalysisIpcHandlers();
  registerFileCrackerIpcHandlers();
  registerHashIpcHandlers();
  registerNetworkIpcHandlers();
  registerOsintIpcHandlers();
  registerCasesIpcHandlers();
  registerSettingsIpcHandlers();
  registerSecretScannerIpcHandlers();
  registerThreatIntelligenceIpcHandlers();

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

let sessionCleanupStarted =
  false;

let sessionCleanupComplete =
  false;

app.on(
  'before-quit',
  (event) => {
    pythonService.stop();

    if (sessionCleanupComplete) {
      return;
    }

    event.preventDefault();

    if (sessionCleanupStarted) {
      return;
    }

    sessionCleanupStarted = true;

    void clearSessionOnExitIfDisabled()
      .catch((error) => {
        console.error(
          'Não foi possível limpar a sessão antes de fechar.',
          error,
        );
      })
      .finally(() => {
        sessionCleanupComplete =
          true;

        app.quit();
      });
  },
);

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
