import {
  stat,
} from 'node:fs/promises';
import {
  extname,
} from 'node:path';
import {
  fileURLToPath,
} from 'node:url';

const electronStub = `
export const ipcMain = { handle() {} };
export const clipboard = { writeText() {} };
export const net = {
  fetch() { throw new Error('Electron net não foi injetado no teste.'); },
  isOnline() { return true; },
};
`;

async function exists(url) {
  try {
    await stat(fileURLToPath(url));
    return true;
  } catch {
    return false;
  }
}

export async function resolve(
  specifier,
  context,
  nextResolve,
) {
  if (specifier === 'electron') {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(electronStub)}`,
    };
  }

  if (
    context.parentURL?.startsWith('file:') &&
    (specifier.startsWith('./') ||
      specifier.startsWith('../')) &&
    ![
      '.ts',
      '.tsx',
      '.js',
      '.mjs',
      '.cjs',
      '.json',
    ].includes(extname(specifier))
  ) {
    const candidate = new URL(
      `${specifier}.ts`,
      context.parentURL,
    );

    if (await exists(candidate)) {
      return {
        shortCircuit: true,
        url: candidate.href,
      };
    }
  }

  return nextResolve(
    specifier,
    context,
  );
}
