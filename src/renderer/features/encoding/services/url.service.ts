export function encodeUrlComponent(
  value: string,
): string {
  try {
    return encodeURIComponent(value);
  } catch {
    throw new Error(
      'Não foi possível codificar o conteúdo informado.',
    );
  }
}

export function decodeUrlComponent(
  value: string,
): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(
      'O conteúdo possui uma codificação URL inválida.',
    );
  }
}
