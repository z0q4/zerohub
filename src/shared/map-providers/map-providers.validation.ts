import type {
  GoogleEmbedRequest,
} from './map-providers.types';

const GOOGLE_API_KEY_PATTERN =
  /^[A-Za-z0-9_-]{20,200}$/;

export function parseGoogleCoordinate(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!value.trim()) {
    throw new TypeError(`${label} é obrigatória.`);
  }

  return finiteNumber(Number(value), label, minimum, maximum);
}

function finiteNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError(
      `${field} precisa estar entre ${minimum} e ${maximum}.`,
    );
  }

  return value;
}

function optionalFiniteNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number | undefined {
  return value === undefined
    ? undefined
    : finiteNumber(
        value,
        field,
        minimum,
        maximum,
      );
}

export function validateGoogleMapsApiKey(
  value: unknown,
): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      'A chave do Google Maps precisa ser um texto.',
    );
  }

  const apiKey = value.trim();

  if (!GOOGLE_API_KEY_PATTERN.test(apiKey)) {
    throw new TypeError(
      'A chave do Google Maps deve conter de 20 a 200 caracteres alfanuméricos, hífen ou sublinhado.',
    );
  }

  return apiKey;
}

export function validateGoogleEmbedRequest(
  value: unknown,
): GoogleEmbedRequest {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      'A solicitação do mapa Google é inválida.',
    );
  }

  const request = value as Record<
    string,
    unknown
  >;

  if (
    request.mode !== 'map-2d' &&
    request.mode !== 'street-360'
  ) {
    throw new TypeError(
      'A modalidade Google informada não é suportada.',
    );
  }

  return {
    mode: request.mode,
    latitude: finiteNumber(
      request.latitude,
      'A latitude',
      -90,
      90,
    ),
    longitude: finiteNumber(
      request.longitude,
      'A longitude',
      -180,
      180,
    ),
    zoom: optionalFiniteNumber(
      request.zoom,
      'O zoom',
      0,
      21,
    ),
    heading: optionalFiniteNumber(
      request.heading,
      'A direção',
      -360,
      360,
    ),
    pitch: optionalFiniteNumber(
      request.pitch,
      'A inclinação',
      -90,
      90,
    ),
    fov: optionalFiniteNumber(
      request.fov,
      'O campo de visão',
      10,
      100,
    ),
  };
}
