import {
  registerCasesIpcHandlers,
} from './main/ipc/cases.ipc';

import {
  registerAuthIpcHandlers,
} from './main/ipc/auth.ipc';

import {
  registerClipboardIpcHandlers,
} from './main/ipc/clipboard.ipc';

import {
  registerIocIntelligenceIpcHandlers,
} from './main/ipc/ioc-intelligence.ipc';

import {
  registerIpGeolocationIpcHandlers,
} from './main/ipc/ip-geolocation.ipc';

import {
  registerMapProvidersIpcHandlers,
} from './main/ipc/map-providers.ipc';

import {
  registerGeographicSearchIpcHandlers,
} from './main/ipc/geographic-search.ipc';
import { registerIbgeBoundariesIpcHandlers } from './main/ipc/ibge-boundaries.ipc';
import { registerRecifeGeometryIpcHandlers } from './main/ipc/recife-geometry.ipc';

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
  Menu,
  nativeImage,
  session,
  Tray,
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

import {
  lockAuth,
} from './main/services/auth.service';

if (started) {
  app.quit();
}

const PRODUCTION_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

let applicationExitRequested =
  false;

let tray: Tray | null = null;

async function lockWindow(
  mainWindow: BrowserWindow,
): Promise<void> {
  const status = await lockAuth();

  if (
    !mainWindow
      .webContents
      .isDestroyed()
  ) {
    mainWindow
      .webContents
      .send(
        'auth:locked',
        status,
      );
  }
}

function lockWindowSafely(
  mainWindow: BrowserWindow,
): void {
  void lockWindow(mainWindow)
    .catch((error) => {
      console.error(
        'Não foi possível bloquear a sessão local.',
        error,
      );
    });
}

function createApplicationTray(
  mainWindow: BrowserWindow,
): void {
  if (tray) {
    return;
  }

  const iconPath = path.join(
    app.getAppPath(),
    'resources',
    'icons',
    'zerohub.png',
  );
  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({
      width: 18,
      height: 18,
    });

  tray = new Tray(icon);
  tray.setToolTip(
    'ZeroHub — sessão local',
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Abrir ZeroHub',
        click: () => {
          if (
            mainWindow.isMinimized()
          ) {
            mainWindow.restore();
          }

          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Bloquear',
        click: () => {
          lockWindowSafely(
            mainWindow,
          );
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Sair',
        click: () => {
          applicationExitRequested =
            true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });
}

function configureProductionCsp(): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return;
  }

  session.defaultSession.webRequest
    .onHeadersReceived(
      (details, callback) => {
        if (
          details.resourceType !==
            'mainFrame'
        ) {
          callback({
            responseHeaders:
              details.responseHeaders,
          });
          return;
        }

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              PRODUCTION_CONTENT_SECURITY_POLICY,
            ],
          },
        });
      },
    );
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

  mainWindow.webContents
    .setWindowOpenHandler(() => ({
      action: 'deny',
    }));

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.session
    .setPermissionRequestHandler(
      (_webContents, _permission, callback) => {
        callback(false);
      },
    );

  createApplicationTray(
    mainWindow,
  );

  mainWindow.on(
    'minimize',
    () => {
      mainWindow.hide();
      lockWindowSafely(
        mainWindow,
      );
    },
  );

  mainWindow.on(
    'close',
    (event) => {
      if (applicationExitRequested) {
        return;
      }

      event.preventDefault();
      mainWindow.hide();
      lockWindowSafely(
        mainWindow,
      );
    },
  );

  mainWindow.webContents.on(
    'before-input-event',
    (event, input) => {
      if (
        input.type !== 'keyDown' ||
        input.key !== 'F1' ||
        input.isAutoRepeat
      ) {
        return;
      }

      event.preventDefault();

      lockWindowSafely(
        mainWindow,
      );
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
  configureProductionCsp();
  registerAuthIpcHandlers();
  registerClipboardIpcHandlers();
  registerGeographicSearchIpcHandlers();
  registerIbgeBoundariesIpcHandlers();
  registerRecifeGeometryIpcHandlers();
  registerEncodingIpcHandlers();
  registerIpGeolocationIpcHandlers();
  registerMapProvidersIpcHandlers();
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
      return;
    }

    const [mainWindow] =
      BrowserWindow
        .getAllWindows();

    if (mainWindow?.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow?.show();
    mainWindow?.focus();
  });
});

let sessionCleanupStarted =
  false;

let sessionCleanupComplete =
  false;

app.on(
  'before-quit',
  (event) => {
    applicationExitRequested =
      true;
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
    if (applicationExitRequested) {
      app.quit();
    }
  },
);
