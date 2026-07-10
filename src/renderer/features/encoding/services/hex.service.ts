export function encodeHexUtf8(
  value: string,
): string {
  const bytes =
    new TextEncoder().encode(value);

  return Array.from(
    bytes,
    (byte) =>
      byte
        .toString(16)
        .padStart(2, '0'),
  ).join('');
}

export function decodeHexUtf8(
  value: string,
): string {
  const normalized = value
    .trim()
    .replace(/^0x/i, '')
    .replace(/\s+/g, '');

  if (!normalized) {
    throw new Error(
      'Digite um conteúdo hexadecimal para decodificar.',
    );
  }

  if (
    !/^[0-9a-fA-F]+$/.test(normalized)
  ) {
    throw new Error(
      'O conteúdo possui caracteres que não pertencem ao formato hexadecimal.',
    );
  }

  if (normalized.length % 2 !== 0) {
    throw new Error(
      'O conteúdo hexadecimal precisa possuir uma quantidade par de caracteres.',
    );
  }

  const bytes = new Uint8Array(
    normalized.length / 2,
  );

  for (
    let index = 0;
    index < normalized.length;
    index += 2
  ) {
    bytes[index / 2] = Number.parseInt(
      normalized.slice(
        index,
        index + 2,
      ),
      16,
    );
  }

  try {
    return new TextDecoder('utf-8', {
      fatal: true,
    }).decode(bytes);
  } catch {
    throw new Error(
      'O hexadecimal é válido, mas não representa um texto UTF-8 válido.',
    );
  }
}
