import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import doxbinAscii from '../../assets/doxbin-logo.txt?raw';
import {
  AUTH_AUTO_LOCK_MS,
  AUTH_USERNAMES,
  type AuthUsername,
} from '../../../shared/auth/auth.constants';
import type {
  AuthAttemptResult,
  AuthStatus,
} from '../../../shared/auth/auth.types';
import {
  LoginParticleField,
} from './LoginParticleField';

type AuthenticationGateProps = {
  children: ReactNode;
};

type SetupAccountState = Record<
  AuthUsername,
  {
    password: string;
    passwordConfirmation: string;
    unlockPassword: string;
    unlockPasswordConfirmation: string;
  }
>;

function createSetupState():
  SetupAccountState {
  return {
    z0x4: {
      password: '',
      passwordConfirmation: '',
      unlockPassword: '',
      unlockPasswordConfirmation: '',
    },
    kona67: {
      password: '',
      passwordConfirmation: '',
      unlockPassword: '',
      unlockPasswordConfirmation: '',
    },
  };
}

export function AuthenticationGate({
  children,
}: AuthenticationGateProps) {
  const [status, setStatus] =
    useState<AuthStatus | null>(null);
  const [sessionStarted, setSessionStarted] =
    useState(false);
  const [username, setUsername] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [passwordConfirmation,
    setPasswordConfirmation] =
    useState('');
  const [setupAccounts, setSetupAccounts] =
    useState<SetupAccountState>(
      createSetupState,
    );
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState('');
  const [error, setError] =
    useState('');
  const [retryRemaining, setRetryRemaining] =
    useState(0);
  const firstInputRef =
    useRef<HTMLInputElement>(null);
  const focusBeforeLockRef =
    useRef<HTMLElement | null>(null);
  const overlayWasVisibleRef =
    useRef(false);

  const locked = status?.locked ?? true;
  const configured =
    status?.configured ?? false;
  const requiresUnlockSetup =
    status?.requiresUnlockSetup ?? false;
  const initialLogin =
    configured && !sessionStarted;
  const sessionUnlock =
    configured &&
    sessionStarted &&
    locked;
  const overlayVisible =
    locked || requiresUnlockSetup;

  useEffect(() => {
    let mounted = true;

    void window.zeroHub.auth
      .getStatus()
      .then((nextStatus) => {
        if (!mounted) {
          return;
        }

        setStatus(nextStatus);
        setSessionStarted(
          nextStatus.activeUsername !== null,
        );
        setRetryRemaining(
          nextStatus.retryAfterMs,
        );
      })
      .catch(() => {
        if (mounted) {
          setError(
            'Não foi possível iniciar o controle de acesso local.',
          );
        }
      });

    const unsubscribe =
      window.zeroHub.auth.onLocked(
        (nextStatus) => {
          if (
            !document.querySelector(
              '.authOverlay',
            ) &&
            document.activeElement instanceof
              HTMLElement &&
            document.activeElement !==
              document.body
          ) {
            focusBeforeLockRef.current =
              document.activeElement;
          }

          setStatus(nextStatus);
          setSessionStarted(
            nextStatus.activeUsername !== null,
          );
          setPassword('');
          setPasswordConfirmation('');
          setMessage('');
          setError('');
          setRetryRemaining(
            nextStatus.retryAfterMs,
          );
        },
      );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const wasVisible =
      overlayWasVisibleRef.current;
    overlayWasVisibleRef.current =
      overlayVisible;

    if (overlayVisible) {
      firstInputRef.current?.focus();
      return undefined;
    }

    if (!wasVisible) {
      return undefined;
    }

    const previous =
      focusBeforeLockRef.current;
    focusBeforeLockRef.current = null;

    if (!previous?.isConnected) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(
      () => {
        previous.focus();
      },
    );

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    initialLogin,
    overlayVisible,
    requiresUnlockSetup,
    sessionUnlock,
  ]);

  useEffect(() => {
    if (locked || !sessionStarted) {
      return;
    }

    let timer = 0;

    function scheduleLock(): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          void window.zeroHub.auth
            .lock()
            .catch(() => {
              setError(
                'Não foi possível aplicar o bloqueio automático.',
              );
            });
        },
        AUTH_AUTO_LOCK_MS,
      );
    }

    const activityEvents = [
      'keydown',
      'pointerdown',
      'wheel',
      'touchstart',
    ] as const;

    for (const activityEvent of activityEvents) {
      window.addEventListener(
        activityEvent,
        scheduleLock,
        {
          capture: true,
          passive:
            activityEvent !== 'keydown',
        },
      );
    }

    scheduleLock();

    return () => {
      window.clearTimeout(timer);

      for (
        const activityEvent of activityEvents
      ) {
        window.removeEventListener(
          activityEvent,
          scheduleLock,
          { capture: true },
        );
      }
    };
  }, [locked, sessionStarted]);

  useEffect(() => {
    if (retryRemaining <= 0) {
      return;
    }

    const startedAt = Date.now();
    const initial = retryRemaining;
    const timer = window.setInterval(
      () => {
        setRetryRemaining(
          Math.max(
            0,
            initial -
              (Date.now() - startedAt),
          ),
        );
      },
      250,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [retryRemaining > 0]);

  function updateSetupAccount(
    accountUsername: AuthUsername,
    field:
      | 'password'
      | 'passwordConfirmation'
      | 'unlockPassword'
      | 'unlockPasswordConfirmation',
    value: string,
  ): void {
    setSetupAccounts((current) => ({
      ...current,
      [accountUsername]: {
        ...current[accountUsername],
        [field]: value,
      },
    }));
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (busy || retryRemaining > 0) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      let result: AuthAttemptResult;

      if (!configured) {
        result = await window.zeroHub.auth.setup({
          accounts: AUTH_USERNAMES.map(
            (accountUsername) => ({
              username: accountUsername,
              ...setupAccounts[accountUsername],
            }),
          ),
        });
      } else if (requiresUnlockSetup) {
        result =
          await window.zeroHub.auth
            .setupUnlock({
              password,
              passwordConfirmation,
            });
      } else if (sessionUnlock) {
        result =
          await window.zeroHub.auth.unlock({
            password,
          });
      } else {
        result =
          await window.zeroHub.auth.login({
            username,
            password,
          });
      }

      setStatus(result.status);
      setRetryRemaining(
        result.status.retryAfterMs,
      );

      if (!result.ok) {
        setError(result.message);
        setPassword('');
        setPasswordConfirmation('');
        return;
      }

      setSessionStarted(true);
      setUsername('');
      setPassword('');
      setPasswordConfirmation('');
      setSetupAccounts(createSetupState());
      setMessage(result.message);
    } catch (caught) {
      setError(
        caught instanceof Error &&
        caught.message
          ? caught.message
          : 'Não foi possível validar o acesso.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!status && !error) {
    return (
      <main
        className="authBootScreen"
        aria-busy="true"
        aria-label="Iniciando acesso seguro"
      >
        <span>
          Inicializando acesso seguro…
        </span>
      </main>
    );
  }

  const minimalAccess =
    configured && !requiresUnlockSetup;
  const title = minimalAccess
    ? 'ZeroHub'
    : !configured
    ? 'Configurar acessos'
    : requiresUnlockSetup
    ? 'Criar senha de desbloqueio'
    : 'ZeroHub';
  const description = !configured
    ? 'Defina a senha principal e a senha curta de desbloqueio para cada conta.'
    : requiresUnlockSetup
    ? 'Sua senha principal foi preservada. Crie uma senha curta para os próximos bloqueios desta sessão.'
    : sessionUnlock
    ? 'Informe somente a senha curta de desbloqueio.'
    : 'Informe seu login e a senha principal.';

  return (
    <div
      className={
        overlayVisible
          ? 'authSession authSessionLocked'
          : 'authSession'
      }
    >
      {sessionStarted ? (
        <div
          className="authProtectedContent"
          inert={overlayVisible}
          aria-hidden={overlayVisible}
        >
          {children}
        </div>
      ) : (
        <div
          className={
            initialLogin
              ? 'authBackdrop authLoginBackdrop'
              : 'authBackdrop'
          }
          aria-hidden="true"
        />
      )}

      {initialLogin && (
        <LoginParticleField />
      )}

      {overlayVisible && (
        <main
          className={
            initialLogin
              ? 'authOverlay authLoginOverlay'
              : 'authOverlay'
          }
          aria-labelledby="auth-title"
          aria-modal="true"
          role="dialog"
        >
          <section
            className={
              minimalAccess
                ? 'authCard authMinimalCard'
                : configured
                ? 'authCard'
                : 'authCard authSetupCard'
            }
            aria-busy={busy}
          >
            <pre
              className="authAsciiLogo"
              role="img"
              aria-label="Doxbin"
            >
              {doxbinAscii}
            </pre>

            {!minimalAccess && (
              <p className="authEyebrow">
                ZEROHUB · LOCAL ACCESS
              </p>
            )}
            <h1 id="auth-title">{title}</h1>
            {!minimalAccess && (
              <p className="authDescription">
                {description}
              </p>
            )}

            <form
              aria-describedby="auth-feedback"
              onSubmit={submit}
            >
              {!configured ? (
                <div className="authSetupAccounts">
                  {AUTH_USERNAMES.map(
                    (accountUsername) => (
                      <fieldset
                        key={accountUsername}
                      >
                        <legend>
                          Conta{' '}
                          <code>
                            {accountUsername}
                          </code>
                        </legend>

                        <label>
                          <span>
                            Senha principal
                          </span>
                          <input
                            autoComplete="new-password"
                            maxLength={128}
                            minLength={10}
                            name={`${accountUsername}-password`}
                            required
                            type="password"
                            value={
                              setupAccounts[
                                accountUsername
                              ].password
                            }
                            onChange={(event) => {
                              updateSetupAccount(
                                accountUsername,
                                'password',
                                event.target.value,
                              );
                            }}
                          />
                        </label>

                        <label>
                          <span>
                            Confirmar principal
                          </span>
                          <input
                            autoComplete="new-password"
                            maxLength={128}
                            minLength={10}
                            name={`${accountUsername}-confirmation`}
                            required
                            type="password"
                            value={
                              setupAccounts[
                                accountUsername
                              ]
                                .passwordConfirmation
                            }
                            onChange={(event) => {
                              updateSetupAccount(
                                accountUsername,
                                'passwordConfirmation',
                                event.target.value,
                              );
                            }}
                          />
                        </label>

                        <label>
                          <span>
                            Senha curta de desbloqueio
                          </span>
                          <input
                            autoComplete="new-password"
                            maxLength={64}
                            minLength={4}
                            name={`${accountUsername}-unlock-password`}
                            required
                            type="password"
                            value={
                              setupAccounts[
                                accountUsername
                              ].unlockPassword
                            }
                            onChange={(event) => {
                              updateSetupAccount(
                                accountUsername,
                                'unlockPassword',
                                event.target.value,
                              );
                            }}
                          />
                        </label>

                        <label>
                          <span>
                            Confirmar desbloqueio
                          </span>
                          <input
                            autoComplete="new-password"
                            maxLength={64}
                            minLength={4}
                            name={`${accountUsername}-unlock-confirmation`}
                            required
                            type="password"
                            value={
                              setupAccounts[
                                accountUsername
                              ]
                                .unlockPasswordConfirmation
                            }
                            onChange={(event) => {
                              updateSetupAccount(
                                accountUsername,
                                'unlockPasswordConfirmation',
                                event.target.value,
                              );
                            }}
                          />
                        </label>
                      </fieldset>
                    ),
                  )}
                </div>
              ) : initialLogin ? (
                <>
                  <label>
                    <span>Login</span>
                    <input
                      ref={firstInputRef}
                      autoCapitalize="none"
                      autoComplete="username"
                      maxLength={32}
                      required
                      spellCheck={false}
                      type="text"
                      aria-invalid={
                        error ? true : undefined
                      }
                      value={username}
                      onChange={(event) => {
                        setUsername(
                          event.target.value,
                        );
                      }}
                    />
                  </label>

                  <label>
                    <span>Password</span>
                    <input
                      autoComplete="current-password"
                      maxLength={128}
                      required
                      type="password"
                      aria-invalid={
                        error ? true : undefined
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value,
                        );
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>
                      {requiresUnlockSetup
                        ? 'Nova senha de desbloqueio'
                        : 'Password'}
                    </span>
                    <input
                      ref={firstInputRef}
                      autoComplete={
                        requiresUnlockSetup
                          ? 'new-password'
                          : 'current-password'
                      }
                      maxLength={64}
                      minLength={
                        requiresUnlockSetup
                          ? 4
                          : 1
                      }
                      required
                      type="password"
                      aria-invalid={
                        error ? true : undefined
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value,
                        );
                      }}
                    />
                  </label>

                  {requiresUnlockSetup && (
                    <label>
                      <span>
                        Confirmar desbloqueio
                      </span>
                      <input
                        autoComplete="new-password"
                        maxLength={64}
                        minLength={4}
                        required
                        type="password"
                        value={
                          passwordConfirmation
                        }
                        onChange={(event) => {
                          setPasswordConfirmation(
                            event.target.value,
                          );
                        }}
                      />
                    </label>
                  )}
                </>
              )}

              {!configured && (
                <small className="authHint">
                  A senha principal exige 10
                  caracteres, uma letra e um
                  número. A senha curta exige 4
                  caracteres e deve ser diferente.
                  Não existe recuperação.
                </small>
              )}

              {requiresUnlockSetup && (
                <small className="authHint">
                  Essa senha funcionará somente
                  depois do login principal e
                  enquanto o aplicativo continuar
                  aberto.
                </small>
              )}

              <div
                className="authFeedback"
                id="auth-feedback"
                aria-live="polite"
                aria-atomic="true"
              >
                {error && (
                  <p role="alert">{error}</p>
                )}
                {!minimalAccess &&
                  !error && message && (
                  <p>{message}</p>
                )}
                {retryRemaining > 0 && (
                  <p>
                    Nova tentativa em{' '}
                    {Math.ceil(
                      retryRemaining / 1_000,
                    )}s.
                  </p>
                )}
              </div>

              <button
                className="authSubmit"
                disabled={
                  busy || retryRemaining > 0
                }
                type="submit"
              >
                {minimalAccess
                  ? 'START'
                  : busy
                  ? 'Validando…'
                  : !configured
                  ? 'Criar acessos'
                  : requiresUnlockSetup
                  ? 'Salvar senha curta'
                  : sessionUnlock
                  ? 'Desbloquear'
                  : 'Entrar'}
              </button>
            </form>

            {!minimalAccess && (
              <footer>
                <span>F1 · bloqueio focado</span>
                <span>Auto-lock · 03:33</span>
                <span>Fechar · bandeja</span>
              </footer>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
