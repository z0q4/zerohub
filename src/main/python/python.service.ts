import {
  app,
} from 'electron';

import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';

import {
  existsSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  randomUUID,
} from 'node:crypto';

import type {
  PythonRequest,
  PythonResponse,
} from '../../shared/python/python.types';

type PendingRequest = {
  resolve(value: unknown): void;
  reject(reason: Error): void;
  timer: NodeJS.Timeout;
};

const REQUEST_TIMEOUT_MS =
  20_000;

class PythonService {
  private process:
    ChildProcessWithoutNullStreams | null =
      null;

  private outputBuffer = '';

  private pending =
    new Map<string, PendingRequest>();

  private getPythonEntryPath():
    string {
    if (app.isPackaged) {
      return join(
        process.resourcesPath,
        'python',
        'main.py',
      );
    }

    return join(
      app.getAppPath(),
      'python',
      'main.py',
    );
  }

  private getPythonCommand():
    string {
    return process.env.ZEROHUB_PYTHON
      || 'python3';
  }

  private ensureStarted(): void {
    if (
      this.process &&
      !this.process.killed
    ) {
      return;
    }

    const entryPath =
      this.getPythonEntryPath();

    if (!existsSync(entryPath)) {
      throw new Error(
        `O backend Python não foi encontrado em: ${entryPath}`,
      );
    }

    const child =
      spawn(
        this.getPythonCommand(),
        ['-u', entryPath],
        {
          cwd:
            join(
              entryPath,
              '..',
            ),

          stdio: [
            'pipe',
            'pipe',
            'pipe',
          ],

          env: {
            ...process.env,

            PYTHONUNBUFFERED:
              '1',
          },
        },
      );

    child.stdout.setEncoding(
      'utf8',
    );

    child.stderr.setEncoding(
      'utf8',
    );

    child.stdout.on(
      'data',
      (chunk: string) => {
        this.handleOutput(chunk);
      },
    );

    child.stderr.on(
      'data',
      (chunk: string) => {
        console.error(
          '[ZeroHub Python]',
          chunk.trimEnd(),
        );
      },
    );

    child.once(
      'error',
      (error) => {
        this.rejectAll(
          new Error(
            `Não foi possível iniciar o Python: ${error.message}`,
          ),
        );

        this.process = null;
      },
    );

    child.once(
      'exit',
      (
        code,
        signal,
      ) => {
        this.rejectAll(
          new Error(
            `O processo Python foi encerrado. Código: ${code ?? '—'}, sinal: ${signal ?? '—'}.`,
          ),
        );

        this.process = null;
        this.outputBuffer = '';
      },
    );

    this.process = child;
  }

  private handleOutput(
    chunk: string,
  ): void {
    this.outputBuffer += chunk;

    while (true) {
      const lineEnd =
        this.outputBuffer.indexOf(
          '\n',
        );

      if (lineEnd === -1) {
        break;
      }

      const line =
        this.outputBuffer
          .slice(0, lineEnd)
          .trim();

      this.outputBuffer =
        this.outputBuffer.slice(
          lineEnd + 1,
        );

      if (!line) {
        continue;
      }

      this.handleResponse(line);
    }
  }

  private handleResponse(
    line: string,
  ): void {
    let response:
      PythonResponse<unknown>;

    try {
      response =
        JSON.parse(
          line,
        ) as PythonResponse<unknown>;
    } catch {
      console.error(
        '[ZeroHub Python] Resposta inválida:',
        line,
      );

      return;
    }

    if (!response.id) {
      return;
    }

    const pending =
      this.pending.get(
        response.id,
      );

    if (!pending) {
      return;
    }

    clearTimeout(
      pending.timer,
    );

    this.pending.delete(
      response.id,
    );

    if (response.ok === true) {
      pending.resolve(
        response.result,
      );

      return;
    }

    if ('error' in response) {
      pending.reject(
        new Error(
          response.error.message,
        ),
      );

      return;
    }

    pending.reject(
      new Error(
        'O processo Python retornou uma resposta inválida.',
      ),
    );
  }

  private rejectAll(
    error: Error,
  ): void {
    for (
      const [
        requestId,
        pending,
      ] of this.pending
    ) {
      clearTimeout(
        pending.timer,
      );

      pending.reject(error);

      this.pending.delete(
        requestId,
      );
    }
  }

  async invoke<T>(
    action: string,
    payload:
      Record<string, unknown> = {},
    timeoutMs:
      number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    this.ensureStarted();

    const child =
      this.process;

    if (!child) {
      throw new Error(
        'O processo Python não está disponível.',
      );
    }

    const id =
      randomUUID();

    const request:
      PythonRequest = {
        id,
        action,
        payload,
      };

    return new Promise<T>(
      (
        resolve,
        reject,
      ) => {
        const timer =
          setTimeout(() => {
            this.pending.delete(
              id,
            );

            reject(
              new Error(
                `A operação Python '${action}' excedeu o tempo limite.`,
              ),
            );
          }, timeoutMs);

        this.pending.set(
          id,
          {
            resolve:
              resolve as (
                value: unknown,
              ) => void,

            reject,
            timer,
          },
        );

        child.stdin.write(
          `${JSON.stringify(
            request,
          )}\n`,
          'utf8',
          (error) => {
            if (!error) {
              return;
            }

            clearTimeout(
              timer,
            );

            this.pending.delete(
              id,
            );

            reject(
              new Error(
                `Não foi possível enviar dados ao Python: ${error.message}`,
              ),
            );
          },
        );
      },
    );
  }

  stop(): void {
    if (
      this.process &&
      !this.process.killed
    ) {
      this.process.kill();
    }

    this.process = null;
  }
}

export const pythonService =
  new PythonService();
