export type AuthRateLimitState = {
  failedAttempts: number;
  retryAt: number;
};

export const AUTH_MAX_FREE_ATTEMPTS = 5;
export const AUTH_MAX_RETRY_DELAY_MS =
  30_000;

export function authRetryAfterMs(
  retryAt: number,
  now = Date.now(),
): number {
  return Math.max(0, retryAt - now);
}

export function registerAuthFailure<
  State extends AuthRateLimitState,
>(
  state: State,
  now = Date.now(),
): State {
  const failedAttempts =
    state.failedAttempts + 1;

  if (
    failedAttempts <=
      AUTH_MAX_FREE_ATTEMPTS
  ) {
    return {
      ...state,
      failedAttempts,
    };
  }

  const exponent = Math.min(
    failedAttempts -
      AUTH_MAX_FREE_ATTEMPTS - 1,
    5,
  );
  const delay = Math.min(
    AUTH_MAX_RETRY_DELAY_MS,
    1_000 * (2 ** exponent),
  );

  return {
    ...state,
    failedAttempts,
    retryAt: now + delay,
  };
}
