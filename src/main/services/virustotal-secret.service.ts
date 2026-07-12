import {
  app,
  safeStorage,
} from 'electron';

import {
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
  join,
} from 'node:path';

import type {
  VirusTotalSecretStatus,
} from '../../shared/threat-intelligence/threat-intelligence.types';

function getSecretPath(): string {
  return join(
    app.getPath('userData'),
    'secrets',
    'virustotal-api-key.bin',
  );
}

function getStorageBackend(): string {
  if (
    process.platform === 'linux'
  ) {
    return safeStorage
      .getSelectedStorageBackend();
  }

  return 'os-protected';
}

export async function getVirusTotalSecretStatus():
  Promise<VirusTotalSecretStatus> {
  let configured = false;

  try {
    const encrypted =
      await readFile(
        getSecretPath(),
      );

    configured =
      encrypted.length > 0;
  } catch (
    unknownError
  ) {
    const error =
      unknownError as
        NodeJS.ErrnoException;

    if (
      error.code !== 'ENOENT'
    ) {
      throw new Error(
        `Não foi possível verificar a chave do VirusTotal: ${error.message}`,
      );
    }
  }

  const storageBackend =
    getStorageBackend();

  return {
    configured,
    storageBackend,

    protectedByOs:
      safeStorage
        .isEncryptionAvailable() &&
      storageBackend !==
        'basic_text',
  };
}

export async function saveVirusTotalApiKey(
  rawApiKey: string,
): Promise<VirusTotalSecretStatus> {
  const apiKey =
    rawApiKey.trim();

  if (!apiKey) {
    throw new Error(
      'Informe uma chave da API do VirusTotal.',
    );
  }

  if (apiKey.length > 512) {
    throw new Error(
      'A chave excede o limite permitido.',
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

  const secretPath =
    getSecretPath();

  await mkdir(
    dirname(secretPath),
    {
      recursive: true,
      mode: 0o700,
    },
  );

  const encrypted =
    safeStorage.encryptString(
      apiKey,
    );

  await writeFile(
    secretPath,
    encrypted,
    {
      mode: 0o600,
    },
  );

  await chmod(
    secretPath,
    0o600,
  );

  return getVirusTotalSecretStatus();
}

export async function loadVirusTotalApiKey():
  Promise<string> {
  let encrypted: Buffer;

  try {
    encrypted =
      await readFile(
        getSecretPath(),
      );
  } catch (
    unknownError
  ) {
    const error =
      unknownError as
        NodeJS.ErrnoException;

    if (
      error.code === 'ENOENT'
    ) {
      throw new Error(
        'Configure sua chave da API do VirusTotal antes de consultar.',
      );
    }

    throw new Error(
      `Não foi possível carregar a chave do VirusTotal: ${error.message}`,
    );
  }

  try {
    const apiKey =
      safeStorage.decryptString(
        encrypted,
      );

    if (!apiKey.trim()) {
      throw new Error(
        'A chave salva está vazia.',
      );
    }

    return apiKey;

  } catch (
    unknownError
  ) {
    const message =
      unknownError instanceof Error
        ? unknownError.message
        : 'erro desconhecido';

    throw new Error(
      `Não foi possível descriptografar a chave do VirusTotal: ${message}`,
    );
  }
}

export async function removeVirusTotalApiKey():
  Promise<VirusTotalSecretStatus> {
  await rm(
    getSecretPath(),
    {
      force: true,
    },
  );

  return getVirusTotalSecretStatus();
}
