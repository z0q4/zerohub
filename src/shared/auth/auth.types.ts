export type AuthStatus = {
  configured: boolean;
  locked: boolean;
  usernames: string[];
  activeUsername: string | null;
  unlockConfigured: boolean;
  requiresUnlockSetup: boolean;
  failedAttempts: number;
  retryAfterMs: number;
};

export type AuthCredentialsInput = {
  username: string;
  password: string;
};

export type AuthSetupAccountInput =
  AuthCredentialsInput & {
    passwordConfirmation: string;
    unlockPassword: string;
    unlockPasswordConfirmation: string;
  };

export type AuthSetupInput = {
  accounts: AuthSetupAccountInput[];
};

export type AuthUnlockInput = {
  password: string;
};

export type AuthUnlockSetupInput =
  AuthUnlockInput & {
    passwordConfirmation: string;
  };

export type AuthAttemptResult = {
  ok: boolean;
  message: string;
  status: AuthStatus;
};
