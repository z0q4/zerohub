import type {
  AuthCredentialsInput,
  AuthSetupAccountInput,
  AuthSetupInput,
  AuthUnlockInput,
  AuthUnlockSetupInput,
} from './auth.types';

import {
  AUTH_USERNAMES,
  type AuthUsername,
} from './auth.constants';

const USERNAME_PATTERN =
  /^[a-zA-Z0-9._-]{3,32}$/;

function readRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      'As credenciais precisam ser um objeto.',
    );
  }

  return value as Record<
    string,
    unknown
  >;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string {
  const value = record[key];

  if (
    !Object.hasOwn(record, key) ||
    typeof value !== 'string' ||
    value.length > maximumLength
  ) {
    throw new TypeError(
      'Credenciais inválidas.',
    );
  }

  return value;
}

export function normalizeUsername(
  username: string,
): string {
  return username.trim();
}

export function isAuthUsername(
  value: string,
): value is AuthUsername {
  return AUTH_USERNAMES.some(
    (username) =>
      username === value,
  );
}

export function validateCredentialsInput(
  value: unknown,
): AuthCredentialsInput {
  const record = readRecord(value);
  const username = normalizeUsername(
    readString(
      record,
      'username',
      64,
    ),
  );
  const password = readString(
    record,
    'password',
    128,
  );

  if (
    !USERNAME_PATTERN.test(username) ||
    !isAuthUsername(username) ||
    password.length < 1
  ) {
    throw new TypeError(
      'Credenciais inválidas.',
    );
  }

  return {
    username,
    password,
  };
}

function validateSetupAccount(
  value: unknown,
): AuthSetupAccountInput {
  const record = readRecord(value);
  const credentials =
    validateCredentialsInput(record);
  const passwordConfirmation =
    readString(
      record,
      'passwordConfirmation',
      128,
    );
  const unlockPassword = readString(
    record,
    'unlockPassword',
    64,
  );
  const unlockPasswordConfirmation =
    readString(
      record,
      'unlockPasswordConfirmation',
      64,
    );

  if (
    credentials.password.length < 10 ||
    !/[a-zA-Z]/.test(
      credentials.password,
    ) ||
    !/[0-9]/.test(
      credentials.password,
    )
  ) {
    throw new TypeError(
      'Use uma senha com pelo menos 10 caracteres, uma letra e um número.',
    );
  }

  if (
    credentials.password !==
    passwordConfirmation
  ) {
    throw new TypeError(
      'A confirmação da senha não corresponde.',
    );
  }

  if (unlockPassword.length < 4) {
    throw new TypeError(
      'Use uma senha de desbloqueio com pelo menos 4 caracteres.',
    );
  }

  if (
    unlockPassword !==
    unlockPasswordConfirmation
  ) {
    throw new TypeError(
      'A confirmação da senha de desbloqueio não corresponde.',
    );
  }

  if (
    credentials.password ===
    unlockPassword
  ) {
    throw new TypeError(
      'A senha principal e a senha de desbloqueio precisam ser diferentes.',
    );
  }

  return {
    ...credentials,
    passwordConfirmation,
    unlockPassword,
    unlockPasswordConfirmation,
  };
}

export function validateUnlockInput(
  value: unknown,
): AuthUnlockInput {
  const record = readRecord(value);
  const password = readString(
    record,
    'password',
    64,
  );

  if (password.length < 1) {
    throw new TypeError(
      'Senha de desbloqueio inválida.',
    );
  }

  return { password };
}

export function validateUnlockSetupInput(
  value: unknown,
): AuthUnlockSetupInput {
  const record = readRecord(value);
  const { password } =
    validateUnlockInput(record);
  const passwordConfirmation =
    readString(
      record,
      'passwordConfirmation',
      64,
    );

  if (password.length < 4) {
    throw new TypeError(
      'Use uma senha de desbloqueio com pelo menos 4 caracteres.',
    );
  }

  if (
    password !== passwordConfirmation
  ) {
    throw new TypeError(
      'A confirmação da senha de desbloqueio não corresponde.',
    );
  }

  return {
    password,
    passwordConfirmation,
  };
}

export function validateSetupInput(
  value: unknown,
): AuthSetupInput {
  const record = readRecord(value);
  const rawAccounts =
    record.accounts;

  if (
    !Object.hasOwn(record, 'accounts') ||
    !Array.isArray(rawAccounts) ||
    rawAccounts.length !==
      AUTH_USERNAMES.length
  ) {
    throw new TypeError(
      'Configure exatamente as contas locais autorizadas.',
    );
  }

  const accounts =
    rawAccounts.map(
      validateSetupAccount,
    );
  const configuredUsernames =
    new Set(
      accounts.map(
        (account) =>
          account.username,
      ),
    );

  if (
    configuredUsernames.size !==
      AUTH_USERNAMES.length ||
    AUTH_USERNAMES.some(
      (username) =>
        !configuredUsernames.has(
          username,
        ),
    )
  ) {
    throw new TypeError(
      'As contas locais estão duplicadas ou ausentes.',
    );
  }

  return {
    accounts,
  };
}
