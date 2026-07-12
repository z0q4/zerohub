export type FileCrackMode =
  | 'bruteforce'
  | 'wordlist';

export type FileCrackRequest = {
  zipPath: string;
  mode: FileCrackMode;
  wordlistPath?: string;
  length?: number;
  useLetters?: boolean;
  useNumbers?: boolean;
  useSpecial?: boolean;
};

export type FileCrackResult = {
  zipPath: string;
  mode: FileCrackMode;
  found: boolean;
  password: string | null;
  attempts: number;
  message: string;
};
