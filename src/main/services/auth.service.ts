import { app, safeStorage } from 'electron';
import {
  access,
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  AUTH_USERNAMES,
} from '../../shared/auth/auth.constants';
import {
  authRetryAfterMs,
  registerAuthFailure,
} from '../../shared/auth/auth-rate-limit';
import type {
  AuthAttemptResult,
  AuthCredentialsInput,
  AuthSetupInput,
  AuthStatus,
  AuthUnlockInput,
  AuthUnlockSetupInput,
} from '../../shared/auth/auth.types';

const scryptAsync = promisify(scrypt);
const AUTH_RECORD_VERSION = 3;
const DERIVED_KEY_LENGTH = 64;

type AuthAccountRecord = {
  username: string;
  salt: string;
  digest: string;
  unlockSalt: string | null;
  unlockDigest: string | null;
};

type AuthRecord = {
  version: 3;
  accounts: AuthAccountRecord[];
  failedAttempts: number;
  retryAt: number;
};

let locked = true;
let activeUsername: string | null = null;

function authPath(): string {
  return path.join(
    app.getPath('userData'),
    'local-auth.bin',
  );
}

async function authRecordExists():
  Promise<boolean> {
  try {
    await access(authPath());
    return true;
  } catch {
    return false;
  }
}

function isBaseAccountRecord(
  value: unknown,
): value is {
  username: string;
  salt: string;
  digest: string;
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const account = value as Record<
    string,
    unknown
  >;

  return (
    typeof account.username ===
      'string' &&
    AUTH_USERNAMES.some(
      (username) =>
        username === account.username,
    ) &&
    typeof account.salt === 'string' &&
    typeof account.digest === 'string'
  );
}

function hasValidRecordEnvelope(
  record: Record<string, unknown>,
): boolean {
  if (
    !Array.isArray(record.accounts) ||
    record.accounts.length !==
      AUTH_USERNAMES.length ||
    !record.accounts.every(
      isBaseAccountRecord,
    ) ||
    typeof record.failedAttempts !==
      'number' ||
    !Number.isSafeInteger(
      record.failedAttempts,
    ) ||
    record.failedAttempts < 0 ||
    typeof record.retryAt !==
      'number' ||
    !Number.isFinite(record.retryAt) ||
    record.retryAt < 0
  ) {
    return false;
  }

  const usernames = new Set(
    record.accounts.map(
      (account) =>
        (account as {
          username: string;
        }).username,
    ),
  );

  return (
    usernames.size ===
      AUTH_USERNAMES.length &&
    AUTH_USERNAMES.every(
      (username) =>
        usernames.has(username),
    )
  );
}

function parseAuthRecord(
  value: unknown,
): AuthRecord | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<
    string,
    unknown
  >;

  if (!hasValidRecordEnvelope(record)) {
    return null;
  }

  const accounts = record.accounts as Array<{
    username: string;
    salt: string;
    digest: string;
    unlockSalt?: unknown;
    unlockDigest?: unknown;
  }>;

  if (record.version === 2) {
    return {
      version: AUTH_RECORD_VERSION,
      accounts: accounts.map(
        (account): AuthAccountRecord => ({
          username: account.username,
          salt: account.salt,
          digest: account.digest,
          unlockSalt: null,
          unlockDigest: null,
        }),
      ),
      failedAttempts:
        record.failedAttempts as number,
      retryAt: record.retryAt as number,
    };
  }

  if (record.version !== AUTH_RECORD_VERSION) {
    return null;
  }

  if (
    !accounts.every((account) => (
      (
        account.unlockSalt === null &&
        account.unlockDigest === null
      ) ||
      (
        typeof account.unlockSalt ===
          'string' &&
        typeof account.unlockDigest ===
          'string'
      )
    ))
  ) {
    return null;
  }

  return {
    version: AUTH_RECORD_VERSION,
    accounts: accounts.map(
      (account) => ({
        username: account.username,
        salt: account.salt,
        digest: account.digest,
        unlockSalt:
          account.unlockSalt as
            string | null,
        unlockDigest:
          account.unlockDigest as
            string | null,
      }),
    ),
    failedAttempts:
      record.failedAttempts as number,
    retryAt: record.retryAt as number,
  };
}

async function readAuthRecord():
  Promise<AuthRecord | null> {
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  try {
    const encoded = await readFile(
      authPath(),
      'utf8',
    );
    const decrypted =
      safeStorage.decryptString(
        Buffer.from(
          encoded.trim(),
          'base64',
        ),
      );

    return parseAuthRecord(
      JSON.parse(decrypted) as unknown,
    );
  } catch {
    return null;
  }
}

async function writeAuthRecord(
  record: AuthRecord,
): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'A proteção segura do sistema operacional não está disponível.',
    );
  }

  const encrypted = safeStorage.encryptString(
    JSON.stringify(record),
  );
  const target = authPath();
  const temporary = `${target}.tmp`;

  await mkdir(path.dirname(target), {
    recursive: true,
  });
  await writeFile(
    temporary,
    encrypted.toString('base64'),
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  await chmod(target, 0o600);
}

async function derivePassword(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return await scryptAsync(
    password,
    salt,
    DERIVED_KEY_LENGTH,
  ) as Buffer;
}

async function createPasswordRecord(
  password: string,
): Promise<{
  salt: string;
  digest: string;
}> {
  const salt = randomBytes(32);
  const digest = await derivePassword(
    password,
    salt,
  );

  return {
    salt: salt.toString('base64'),
    digest: digest.toString('base64'),
  };
}

async function passwordMatches(
  password: string,
  salt: string,
  digest: string,
): Promise<boolean> {
  const expected = Buffer.from(
    digest,
    'base64',
  );
  const actual = await derivePassword(
    password,
    Buffer.from(salt, 'base64'),
  );

  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

async function resetFailures(
  record: AuthRecord,
): Promise<void> {
  if (
    record.failedAttempts === 0 &&
    record.retryAt === 0
  ) {
    return;
  }

  await writeAuthRecord({
    ...record,
    failedAttempts: 0,
    retryAt: 0,
  });
}

function blockedAttempt(
  status: AuthStatus,
): AuthAttemptResult {
  return {
    ok: false,
    message:
      'Muitas tentativas. Aguarde antes de tentar novamente.',
    status,
  };
}

export function isAuthUnlocked(): boolean {
  return !locked;
}

export async function getAuthStatus():
  Promise<AuthStatus> {
  const [record, recordExists] =
    await Promise.all([
      readAuthRecord(),
      authRecordExists(),
    ]);
  const activeAccount =
    record?.accounts.find(
      (account) =>
        account.username ===
        activeUsername,
    );
  const unlockConfigured = Boolean(
    activeAccount?.unlockSalt &&
    activeAccount.unlockDigest,
  );

  return {
    configured: recordExists,
    locked,
    usernames:
      record?.accounts.map(
        (account) => account.username,
      ) ?? [...AUTH_USERNAMES],
    activeUsername,
    unlockConfigured,
    requiresUnlockSetup:
      !locked &&
      activeUsername !== null &&
      !unlockConfigured,
    failedAttempts:
      record?.failedAttempts ?? 0,
    retryAfterMs:
      authRetryAfterMs(
        record?.retryAt ?? 0,
      ),
  };
}

export async function setupAuth(
  input: AuthSetupInput,
): Promise<AuthAttemptResult> {
  if (await authRecordExists()) {
    throw new Error(
      'O acesso local já foi configurado.',
    );
  }

  const accounts = await Promise.all(
    input.accounts.map(
      async (account):
        Promise<AuthAccountRecord> => {
        const [primary, unlock] =
          await Promise.all([
            createPasswordRecord(
              account.password,
            ),
            createPasswordRecord(
              account.unlockPassword,
            ),
          ]);

        return {
          username: account.username,
          salt: primary.salt,
          digest: primary.digest,
          unlockSalt: unlock.salt,
          unlockDigest: unlock.digest,
        };
      },
    ),
  );

  await writeAuthRecord({
    version: AUTH_RECORD_VERSION,
    accounts,
    failedAttempts: 0,
    retryAt: 0,
  });

  locked = false;
  activeUsername =
    accounts[0]?.username ?? null;

  return {
    ok: true,
    message: 'Contas locais configuradas.',
    status: await getAuthStatus(),
  };
}

export async function loginAuth(
  input: AuthCredentialsInput,
): Promise<AuthAttemptResult> {
  const record = await readAuthRecord();

  if (!record) {
    throw new Error(
      await authRecordExists()
        ? 'As credenciais locais não puderam ser lidas com segurança.'
        : 'O acesso local ainda não foi configurado.',
    );
  }

  if (
    authRetryAfterMs(record.retryAt) > 0
  ) {
    return blockedAttempt(
      await getAuthStatus(),
    );
  }

  const account = record.accounts.find(
    (candidate) =>
      candidate.username === input.username,
  );
  const matches = account
    ? await passwordMatches(
      input.password,
      account.salt,
      account.digest,
    )
    : false;

  if (!account || !matches) {
    await writeAuthRecord(
      registerAuthFailure(record),
    );

    return {
      ok: false,
      message: 'Login ou senha inválidos.',
      status: await getAuthStatus(),
    };
  }

  await resetFailures(record);
  locked = false;
  activeUsername = account.username;

  return {
    ok: true,
    message: account.unlockSalt
      ? 'Acesso liberado.'
      : 'Acesso liberado. Cadastre agora a senha curta de desbloqueio.',
    status: await getAuthStatus(),
  };
}

export async function setupUnlockAuth(
  input: AuthUnlockSetupInput,
): Promise<AuthAttemptResult> {
  const record = await readAuthRecord();

  if (
    locked ||
    !activeUsername ||
    !record
  ) {
    throw new Error(
      'Faça o login principal antes de configurar o desbloqueio.',
    );
  }

  const accountIndex =
    record.accounts.findIndex(
      (account) =>
        account.username ===
        activeUsername,
    );
  const account = record.accounts[
    accountIndex
  ];

  if (!account) {
    throw new Error(
      'A conta ativa não está disponível.',
    );
  }

  if (
    account.unlockSalt &&
    account.unlockDigest
  ) {
    throw new Error(
      'A senha de desbloqueio já foi configurada.',
    );
  }

  if (
    await passwordMatches(
      input.password,
      account.salt,
      account.digest,
    )
  ) {
    throw new Error(
      'A senha de desbloqueio precisa ser diferente da senha principal.',
    );
  }

  const unlock = await createPasswordRecord(
    input.password,
  );
  const accounts = [...record.accounts];
  accounts[accountIndex] = {
    ...account,
    unlockSalt: unlock.salt,
    unlockDigest: unlock.digest,
  };

  await writeAuthRecord({
    ...record,
    accounts,
  });

  return {
    ok: true,
    message:
      'Senha curta de desbloqueio configurada.',
    status: await getAuthStatus(),
  };
}

export async function unlockAuth(
  input: AuthUnlockInput,
): Promise<AuthAttemptResult> {
  const record = await readAuthRecord();

  if (!record || !activeUsername) {
    throw new Error(
      'A sessão anterior não está disponível. Reinicie e faça o login principal.',
    );
  }

  if (
    authRetryAfterMs(record.retryAt) > 0
  ) {
    return blockedAttempt(
      await getAuthStatus(),
    );
  }

  const account = record.accounts.find(
    (candidate) =>
      candidate.username ===
      activeUsername,
  );

  if (
    !account?.unlockSalt ||
    !account.unlockDigest
  ) {
    throw new Error(
      'A senha curta ainda não foi configurada para esta conta.',
    );
  }

  const matches = await passwordMatches(
    input.password,
    account.unlockSalt,
    account.unlockDigest,
  );

  if (!matches) {
    await writeAuthRecord(
      registerAuthFailure(record),
    );

    return {
      ok: false,
      message:
        'Senha de desbloqueio inválida.',
      status: await getAuthStatus(),
    };
  }

  await resetFailures(record);
  locked = false;

  return {
    ok: true,
    message: 'Sessão desbloqueada.',
    status: await getAuthStatus(),
  };
}

export async function lockAuth():
  Promise<AuthStatus> {
  const record = await readAuthRecord();
  const activeAccount =
    record?.accounts.find(
      (account) =>
        account.username ===
        activeUsername,
    );

  if (
    !activeAccount?.unlockSalt ||
    !activeAccount.unlockDigest
  ) {
    activeUsername = null;
  }

  locked = true;
  return getAuthStatus();
}
