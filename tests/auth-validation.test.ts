import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_AUTO_LOCK_MS,
  AUTH_USERNAMES,
} from '../src/shared/auth/auth.constants';
import {
  AUTH_MAX_RETRY_DELAY_MS,
  authRetryAfterMs,
  registerAuthFailure,
} from '../src/shared/auth/auth-rate-limit';

import {
  normalizeUsername,
  validateCredentialsInput,
  validateSetupInput,
  validateUnlockInput,
  validateUnlockSetupInput,
} from '../src/shared/auth/auth.validation';

function validSetup() {
  return {
    accounts: [
      {
        username: 'z0x4',
        password: 'senha-segura-123',
        passwordConfirmation:
          'senha-segura-123',
        unlockPassword: 'z0x4',
        unlockPasswordConfirmation:
          'z0x4',
      },
      {
        username: 'kona67',
        password: 'outra-segura-456',
        passwordConfirmation:
          'outra-segura-456',
        unlockPassword: '6767',
        unlockPasswordConfirmation:
          '6767',
      },
    ],
  };
}

test(
  'mantém login case-sensitive e preserva a senha',
  () => {
    assert.equal(
      normalizeUsername('  z0x4  '),
      'z0x4',
    );

    assert.deepEqual(
      validateCredentialsInput({
        username: ' z0x4 ',
        password: ' Senha 123 ',
      }),
      {
        username: 'z0x4',
        password: ' Senha 123 ',
      },
    );

    assert.throws(
      () =>
        validateCredentialsInput({
          username: 'Z0x4',
          password: ' Senha 123 ',
        }),
      TypeError,
    );
  },
);

test(
  'aceita somente as duas contas autorizadas',
  () => {
    assert.deepEqual(
      AUTH_USERNAMES,
      ['z0x4', 'kona67'],
    );
    assert.equal(
      AUTH_AUTO_LOCK_MS,
      213_000,
    );

    assert.throws(
      () =>
        validateCredentialsInput({
          username: 'terceiro',
          password: 'senha',
        }),
      TypeError,
    );
  },
);

test(
  'rejeita payloads e logins hostis',
  () => {
    const inheritedCredentials =
      Object.create({
        username: 'z0x4',
        password: 'password',
      }) as unknown;
    const invalidValues: unknown[] = [
      null,
      undefined,
      [],
      'z0x4',
      {},
      {
        username: '__proto__!',
        password: 'password',
      },
      {
        username: 'z0x4',
        password: 123,
      },
      {
        username: 'a'.repeat(65),
        password: 'password',
      },
      {
        username: 'z0x4',
        password: 'x'.repeat(129),
      },
      inheritedCredentials,
    ];

    for (const value of invalidValues) {
      assert.throws(
        () =>
          validateCredentialsInput(
            value,
          ),
        TypeError,
      );
    }
  },
);

test(
  'rejeita payloads hostis de setup e desbloqueio',
  () => {
    const inheritedSetup =
      Object.create({
        accounts: validSetup().accounts,
      }) as unknown;
    const invalidUnlockValues: unknown[] = [
      null,
      [],
      {},
      { password: 1234 },
      { password: '' },
      { password: 'x'.repeat(65) },
      Object.create({ password: '1234' }),
    ];

    assert.throws(
      () => validateSetupInput(
        inheritedSetup,
      ),
      TypeError,
    );

    for (const value of invalidUnlockValues) {
      assert.throws(
        () => validateUnlockInput(value),
        TypeError,
      );
    }

    assert.throws(
      () => validateUnlockSetupInput({
        password: '1234',
        passwordConfirmation: 1234,
      }),
      TypeError,
    );
    assert.throws(
      () => validateUnlockSetupInput(
        Object.create({
          password: '1234',
          passwordConfirmation: '1234',
        }),
      ),
      TypeError,
    );
  },
);

test(
  'exige as duas contas sem duplicação',
  () => {
    assert.deepEqual(
      validateSetupInput(
        validSetup(),
      ),
      validSetup(),
    );

    assert.throws(
      () =>
        validateSetupInput({
          accounts: [
            validSetup().accounts[0],
          ],
        }),
      /exatamente/,
    );

    assert.throws(
      () =>
        validateSetupInput({
          accounts: [
            validSetup().accounts[0],
            validSetup().accounts[0],
          ],
        }),
      /duplicadas/,
    );
  },
);

test(
  'exige senha forte e confirmação por conta',
  () => {
    const weak = validSetup();
    weak.accounts[0].password =
      'curta123';
    weak.accounts[0]
      .passwordConfirmation =
      'curta123';

    assert.throws(
      () =>
        validateSetupInput(weak),
      /10 caracteres/,
    );

    const mismatch = validSetup();
    mismatch.accounts[1]
      .passwordConfirmation =
      'outra-segura-457';

    assert.throws(
      () =>
        validateSetupInput(mismatch),
      /não corresponde/,
    );
  },
);

test(
  'valida senha curta separada da senha principal',
  () => {
    assert.deepEqual(
      validateUnlockInput({
        password: '1234',
      }),
      { password: '1234' },
    );
    assert.deepEqual(
      validateUnlockSetupInput({
        password: '1234',
        passwordConfirmation: '1234',
      }),
      {
        password: '1234',
        passwordConfirmation: '1234',
      },
    );

    assert.throws(
      () =>
        validateUnlockSetupInput({
          password: '123',
          passwordConfirmation: '123',
        }),
      /4 caracteres/,
    );

    const samePassword = validSetup();
    samePassword.accounts[0]
      .unlockPassword =
      samePassword.accounts[0].password;
    samePassword.accounts[0]
      .unlockPasswordConfirmation =
      samePassword.accounts[0].password;

    assert.throws(
      () =>
        validateSetupInput(samePassword),
      /precisam ser diferentes/,
    );
  },
);

test(
  'aplica atraso progressivo e limitado após tentativas inválidas',
  () => {
    const now = 1_800_000_000_000;
    let state = {
      failedAttempts: 0,
      retryAt: 0,
      preserved: 'value',
    };

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      state = registerAuthFailure(
        state,
        now,
      );
      assert.equal(
        state.retryAt,
        0,
      );
    }

    state = registerAuthFailure(
      state,
      now,
    );
    assert.equal(
      state.retryAt,
      now + 1_000,
    );
    assert.equal(
      state.preserved,
      'value',
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      state = registerAuthFailure(
        state,
        now,
      );
    }

    assert.equal(
      state.retryAt,
      now + AUTH_MAX_RETRY_DELAY_MS,
    );
    assert.equal(
      authRetryAfterMs(
        state.retryAt,
        now,
      ),
      AUTH_MAX_RETRY_DELAY_MS,
    );
    assert.equal(
      authRetryAfterMs(
        state.retryAt,
        state.retryAt + 1,
      ),
      0,
    );
  },
);
