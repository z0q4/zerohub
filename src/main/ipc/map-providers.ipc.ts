import {
  ipcMain,
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import {
  isAuthUnlocked,
} from '../services/auth.service';

import {
  getGoogleMapsKeyStatus,
  loadGoogleMapsApiKey,
  removeGoogleMapsApiKey,
  saveGoogleMapsApiKey,
} from '../services/map-provider-keys.service';

import type {
  GoogleEmbedRequest,
  GoogleEmbedSession,
} from '../../shared/map-providers/map-providers.types';

import {
  validateGoogleEmbedRequest,
} from '../../shared/map-providers/map-providers.validation';

function requireUnlockedSession(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Solicitação de frame não autorizado.');
  }
  if (!isAuthUnlocked()) {
    throw new Error(
      'A sessão local está bloqueada.',
    );
  }
}

function createGoogleEmbedUrl(
  request: GoogleEmbedRequest,
  apiKey: string,
): GoogleEmbedSession {
  const endpoint =
    request.mode === 'map-2d'
      ? 'view'
      : 'streetview';
  const url = new URL(
    `https://www.google.com/maps/embed/v1/${endpoint}`,
  );

  url.searchParams.set('key', apiKey);

  if (request.mode === 'map-2d') {
    url.searchParams.set(
      'center',
      `${request.latitude},${request.longitude}`,
    );
    url.searchParams.set(
      'zoom',
      String(
        Math.round(
          request.zoom ?? 4,
        ),
      ),
    );
    url.searchParams.set(
      'maptype',
      'roadmap',
    );
  } else {
    url.searchParams.set(
      'location',
      `${request.latitude},${request.longitude}`,
    );
    url.searchParams.set(
      'heading',
      String(request.heading ?? 0),
    );
    url.searchParams.set(
      'pitch',
      String(request.pitch ?? 0),
    );
    url.searchParams.set(
      'fov',
      String(request.fov ?? 80),
    );
  }

  return {
    mode: request.mode,
    url: url.toString(),
  };
}

export function registerMapProvidersIpcHandlers():
  void {
  ipcMain.handle(
    'map-providers:google-key-status',
    async (event) => {
      requireUnlockedSession(event);
      return getGoogleMapsKeyStatus();
    },
  );

  ipcMain.handle(
    'map-providers:save-google-key',
    async (event, apiKey: unknown) => {
      requireUnlockedSession(event);
      return saveGoogleMapsApiKey(
        apiKey,
      );
    },
  );

  ipcMain.handle(
    'map-providers:remove-google-key',
    async (event) => {
      requireUnlockedSession(event);
      return removeGoogleMapsApiKey();
    },
  );

  ipcMain.handle(
    'map-providers:create-google-embed',
    async (
      event,
      rawRequest: unknown,
    ) => {
      requireUnlockedSession(event);

      const request =
        validateGoogleEmbedRequest(
          rawRequest,
        );
      const apiKey =
        await loadGoogleMapsApiKey();

      return createGoogleEmbedUrl(
        request,
        apiKey,
      );
    },
  );
}
