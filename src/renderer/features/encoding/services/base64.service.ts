export function encodeBase64Utf8(
  value: string,
): string {
  const bytes = new TextEncoder().encode(value);

  let binary = '';

  const chunkSize = 32_768;

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    const chunk = bytes.subarray(
      index,
      index + chunkSize,
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function decodeBase64Utf8(
  value: string,
): string {
  const normalized = value.replace(/\s+/g, '');

  if (!normalized) {
    throw new Error(
      'Digite um conteúdo Base64 para decodificar.',
    );
  }

  if (normalized.length % 4 === 1) {
    throw new Error(
      'O conteúdo não possui um formato Base64 válido.',
    );
  }

  const paddingLength =
    (4 - (normalized.length % 4)) % 4;

  const padded = normalized.padEnd(
    normalized.length + paddingLength,
    '=',
  );

  let binary: string;

  try {
    binary = atob(padded);
  } catch {
    throw new Error(
      'O conteúdo não possui um formato Base64 válido.',
    );
  }

  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  try {
    return new TextDecoder('utf-8', {
      fatal: true,
    }).decode(bytes);
  } catch {
    throw new Error(
      'O Base64 é válido, mas o resultado não representa texto UTF-8.',
    );
  }
}
