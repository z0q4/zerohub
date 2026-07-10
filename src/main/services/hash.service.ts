import {
  createHash,
} from 'node:crypto';

import {
  createReadStream,
} from 'node:fs';

import {
  stat,
} from 'node:fs/promises';

import {
  basename,
} from 'node:path';

import type {
  HashAlgorithm,
  HashFileResult,
  HashTextRequest,
} from '../../shared/hash/hash.types';

export function hashText(
  request: HashTextRequest,
): string {
  return createHash(request.algorithm)
    .update(request.text, 'utf8')
    .digest('hex');
}

export async function hashFile(
  filePath: string,
  algorithm: HashAlgorithm,
): Promise<HashFileResult> {
  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    throw new Error(
      'O caminho selecionado não representa um arquivo válido.',
    );
  }

  const hash = createHash(algorithm);
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return {
    algorithm,
    digest: hash.digest('hex'),
    fileName: basename(filePath),
    filePath,
    sizeBytes: fileStats.size,
  };
}
