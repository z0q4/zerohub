import {
  app,
  safeStorage,
} from 'electron';

import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MapProviderKeyStatus,
} from '../../shared/map-providers/map-providers.types';

import {
  validateGoogleMapsApiKey,
} from '../../shared/map-providers/map-providers.validation';

function keyPath(): string {
  return path.join(
    app.getPath('userData'),
    'secrets',
    'google-maps-embed-api-key.bin',
  );
}

function storageBackend(): string {
  return process.platform === 'linux'
    ? safeStorage
        .getSelectedStorageBackend()
    : 'os-protected';
}

export async function getGoogleMapsKeyStatus():
  Promise<MapProviderKeyStatus> {
  let configured = false;

  try {
    configured =
      (await readFile(keyPath()))
        .length > 0;
  } catch (unknownError) {
    const error =
      unknownError as NodeJS.ErrnoException;

    if (error.code !== 'ENOENT') {
      throw new Error(
        `Não foi possível verificar a chave do Google Maps: ${error.message}`,
      );
    }
  }

  const backend = storageBackend();

  return {
    configured,
    storageBackend: backend,
    protectedByOs:
      safeStorage
        .isEncryptionAvailable() &&
      backend !== 'basic_text',
  };
}

export async function saveGoogleMapsApiKey(
  rawApiKey: unknown,
): Promise<MapProviderKeyStatus> {
  const apiKey =
    validateGoogleMapsApiKey(
      rawApiKey,
    );

  if (
    !safeStorage
      .isEncryptionAvailable() ||
    storageBackend() === 'basic_text'
  ) {
    throw new Error(
      'O armazenamento seguro do sistema não está disponível. Configure um chaveiro protegido pelo sistema operacional antes de salvar a chave.',
    );
  }

  const target = keyPath();
  const temporary = `${target}.tmp`;

  await mkdir(
    path.dirname(target),
    {
      recursive: true,
      mode: 0o700,
    },
  );

  const encrypted =
    safeStorage.encryptString(
      apiKey,
    );

  try {
    await writeFile(
      temporary,
      encrypted,
      {
        mode: 0o600,
      },
    );
    await chmod(temporary, 0o600);
    await rename(temporary, target);
    await chmod(target, 0o600);
  } catch (error) {
    await rm(temporary, {
      force: true,
    });
    throw error;
  }

  return getGoogleMapsKeyStatus();
}

export async function loadGoogleMapsApiKey():
  Promise<string> {
  let encrypted: Buffer;

  try {
    encrypted = await readFile(
      keyPath(),
    );
  } catch (unknownError) {
    const error =
      unknownError as NodeJS.ErrnoException;

    if (error.code === 'ENOENT') {
      throw new Error(
        'Configure a chave do Google Maps Embed em Settings antes de abrir esta fonte.',
      );
    }

    throw new Error(
      `Não foi possível carregar a chave do Google Maps: ${error.message}`,
    );
  }

  if (
    !safeStorage
      .isEncryptionAvailable()
  ) {
    throw new Error(
      'O armazenamento seguro do sistema não está disponível.',
    );
  }

  try {
    return validateGoogleMapsApiKey(
      safeStorage.decryptString(
        encrypted,
      ),
    );
  } catch (unknownError) {
    const message =
      unknownError instanceof Error
        ? unknownError.message
        : 'erro desconhecido';

    throw new Error(
      `Não foi possível descriptografar a chave do Google Maps: ${message}`,
    );
  }
}

export async function removeGoogleMapsApiKey():
  Promise<MapProviderKeyStatus> {
  await rm(keyPath(), {
    force: true,
  });

  return getGoogleMapsKeyStatus();
}
