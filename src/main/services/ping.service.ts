import {
  spawn,
} from 'node:child_process';

import {
  isIP,
} from 'node:net';

import {
  domainToASCII,
} from 'node:url';

import type {
  PingRequest,
  PingResult,
} from '../../shared/network/ping.types';

const MAX_OUTPUT_LENGTH =
  128 * 1024;

function normalizeTarget(
  rawTarget: string,
): string {
  const target =
    rawTarget.trim();

  if (!target) {
    throw new Error(
      'Informe um endereço IP ou hostname.',
    );
  }

  if (target.length > 253) {
    throw new Error(
      'O alvo informado é muito longo.',
    );
  }

  if (
    target.includes('://') ||
    target.includes('/') ||
    target.includes('?') ||
    target.includes('#') ||
    /\s/.test(target)
  ) {
    throw new Error(
      'Informe somente um IP ou hostname, sem protocolo, caminho ou espaços.',
    );
  }

  const ipVersion =
    isIP(target);

  if (ipVersion !== 0) {
    return target;
  }

  const hostname =
    domainToASCII(
      target
        .toLowerCase()
        .replace(/\.$/, ''),
    );

  if (!hostname) {
    throw new Error(
      'O hostname informado é inválido.',
    );
  }

  const validLabel =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

  const labels =
    hostname.split('.');

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !validLabel.test(label),
    )
  ) {
    throw new Error(
      'O hostname informado possui um formato inválido.',
    );
  }

  return hostname;
}

function validateRequest(
  request: PingRequest,
): PingRequest {
  if (
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > 10
  ) {
    throw new Error(
      'A quantidade de pacotes precisa estar entre 1 e 10.',
    );
  }

  if (
    !Number.isInteger(
      request.timeoutMs,
    ) ||
    request.timeoutMs < 500 ||
    request.timeoutMs > 10_000
  ) {
    throw new Error(
      'O timeout precisa estar entre 500 e 10000 milissegundos.',
    );
  }

  return {
    target:
      normalizeTarget(
        request.target,
      ),

    count:
      request.count,

    timeoutMs:
      request.timeoutMs,
  };
}

function createPingCommand(
  request: PingRequest,
): {
  command: string;
  args: string[];
} {
  const ipVersion =
    isIP(request.target);

  if (process.platform === 'linux') {
    return {
      command: 'ping',

      args: [
        ...(ipVersion === 6
          ? ['-6']
          : []),

        '-n',
        '-c',
        String(request.count),

        '-W',
        String(
          Math.max(
            1,
            Math.ceil(
              request.timeoutMs /
                1000,
            ),
          ),
        ),

        request.target,
      ],
    };
  }

  if (process.platform === 'win32') {
    return {
      command: 'ping',

      args: [
        ...(ipVersion === 6
          ? ['-6']
          : []),

        '-n',
        String(request.count),

        '-w',
        String(request.timeoutMs),

        request.target,
      ],
    };
  }

  throw new Error(
    `Ping ainda não é suportado nesta plataforma: ${process.platform}.`,
  );
}

function appendOutput(
  current: string,
  chunk: string,
): string {
  const next =
    current + chunk;

  if (
    next.length <=
    MAX_OUTPUT_LENGTH
  ) {
    return next;
  }

  return (
    next.slice(
      0,
      MAX_OUTPUT_LENGTH,
    ) +
    '\n\n[Saída limitada pelo ZeroHub]'
  );
}

export async function runPing(
  rawRequest: PingRequest,
): Promise<PingResult> {
  const request =
    validateRequest(rawRequest);

  const {
    command,
    args,
  } =
    createPingCommand(request);

  const startedAt =
    performance.now();

  return new Promise(
    (resolve, reject) => {
      let standardOutput = '';
      let errorOutput = '';
      let finished = false;
      let timedOut = false;

      const child =
        spawn(
          command,
          args,
          {
            shell: false,
            windowsHide: true,
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
          standardOutput =
            appendOutput(
              standardOutput,
              chunk,
            );
        },
      );

      child.stderr.on(
        'data',
        (chunk: string) => {
          errorOutput =
            appendOutput(
              errorOutput,
              chunk,
            );
        },
      );

      const maximumDuration =
        Math.min(
          60_000,
          request.count *
            request.timeoutMs +
            5_000,
        );

      const timer =
        setTimeout(() => {
          timedOut = true;
          child.kill();
        }, maximumDuration);

      child.once(
        'error',
        (error) => {
          if (finished) {
            return;
          }

          finished = true;
          clearTimeout(timer);

          if (
            (
              error as NodeJS.ErrnoException
            ).code === 'ENOENT'
          ) {
            reject(
              new Error(
                'O comando ping não foi encontrado no sistema.',
              ),
            );

            return;
          }

          reject(
            new Error(
              `Não foi possível iniciar o Ping: ${error.message}`,
            ),
          );
        },
      );

      child.once(
        'close',
        (exitCode) => {
          if (finished) {
            return;
          }

          finished = true;
          clearTimeout(timer);

          const output = [
            standardOutput.trim(),
            errorOutput.trim(),
          ]
            .filter(Boolean)
            .join('\n');

          resolve({
            target:
              request.target,

            output:
              output ||
              'O comando não retornou nenhuma saída.',

            success:
              exitCode === 0 &&
              !timedOut,

            timedOut,

            exitCode,

            elapsedMs:
              Number(
                (
                  performance.now() -
                  startedAt
                ).toFixed(2),
              ),
          });
        },
      );
    },
  );
}
