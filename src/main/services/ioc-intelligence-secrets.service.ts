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
  IocKeyInput,
  IocKeyStatus,
} from '../../shared/ioc-intelligence/ioc-intelligence.types';

const EMPTY_KEYS: IocKeyInput = {
  abuseCh: '',
  abuseIpDb: '',
  otx: '',
};

function secretsPath(): string {
  return path.join(
    app.getPath('userData'),
    'ioc-intelligence-secrets.bin',
  );
}

function normalizeKeys(
  keys: IocKeyInput,
): IocKeyInput {
  return {
    abuseCh:
      keys.abuseCh.trim(),

    abuseIpDb:
      keys.abuseIpDb.trim(),

    otx:
      keys.otx.trim(),
  };
}

async function readKeys():
  Promise<IocKeyInput> {
  if (
    !safeStorage
      .isEncryptionAvailable()
  ) {
    return {
      ...EMPTY_KEYS,
    };
  }

  try {
    const encoded =
      await readFile(
        secretsPath(),
        'utf8',
      );

    const decrypted =
      safeStorage.decryptString(
        Buffer.from(
          encoded.trim(),
          'base64',
        ),
      );

    const parsed =
      JSON.parse(
        decrypted,
      ) as Partial<IocKeyInput>;

    return normalizeKeys({
      abuseCh:
        typeof parsed.abuseCh ===
        'string'
          ? parsed.abuseCh
          : '',

      abuseIpDb:
        typeof parsed.abuseIpDb ===
        'string'
          ? parsed.abuseIpDb
          : '',

      otx:
        typeof parsed.otx ===
        'string'
          ? parsed.otx
          : '',
    });
  } catch {
    return {
      ...EMPTY_KEYS,
    };
  }
}

export async function getIocKeys():
  Promise<IocKeyInput> {
  return readKeys();
}

export async function getIocKeyStatus():
  Promise<IocKeyStatus> {
  const keys =
    await readKeys();

  return {
    encryptionAvailable:
      safeStorage
        .isEncryptionAvailable(),

    abuseCh:
      keys.abuseCh.length > 0,

    abuseIpDb:
      keys.abuseIpDb.length > 0,

    otx:
      keys.otx.length > 0,
  };
}

export async function saveIocKeys(
  rawKeys: IocKeyInput,
): Promise<IocKeyStatus> {
  if (
    !safeStorage
      .isEncryptionAvailable()
  ) {
    throw new Error(
      'O armazenamento seguro do sistema não está disponível.',
    );
  }

  const keys =
    normalizeKeys(rawKeys);

  const encrypted =
    safeStorage.encryptString(
      JSON.stringify(keys),
    );

  const target =
    secretsPath();

  const temporary =
    `${target}.tmp`;

  await mkdir(
    path.dirname(target),
    {
      recursive: true,
    },
  );

  await writeFile(
    temporary,
    encrypted.toString(
      'base64',
    ),
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );

  await chmod(
    temporary,
    0o600,
  );

  await rename(
    temporary,
    target,
  );

  await chmod(
    target,
    0o600,
  );

  return getIocKeyStatus();
}

export async function clearIocKeys():
  Promise<IocKeyStatus> {
  await rm(
    secretsPath(),
    {
      force: true,
    },
  );

  return getIocKeyStatus();
}
