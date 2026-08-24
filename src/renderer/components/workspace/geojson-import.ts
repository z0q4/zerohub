import type {
  Feature,
  GeoJsonProperties,
  Geometry,
} from 'geojson';

export const MAX_GEOJSON_BYTES =
  1_048_576;
export const MAX_GEOJSON_FEATURES = 500;
const MAX_JSON_DEPTH = 12;
const MAX_PROPERTY_KEYS = 40;
const MAX_PROPERTY_TEXT = 500;

export type GeoJsonImportPreview = {
  accepted: Feature<Geometry>[];
  rejected: number;
  warnings: string[];
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasSafeDepth(
  value: unknown,
): boolean {
  const stack: Array<{
    depth: number;
    value: unknown;
  }> = [{ depth: 0, value }];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) {
      continue;
    }

    if (current.depth > MAX_JSON_DEPTH) {
      return false;
    }

    if (Array.isArray(current.value)) {
      for (const child of current.value) {
        stack.push({
          depth: current.depth + 1,
          value: child,
        });
      }
    } else if (isRecord(current.value)) {
      for (const child of Object.values(
        current.value,
      )) {
        stack.push({
          depth: current.depth + 1,
          value: child,
        });
      }
    }
  }

  return true;
}

function validPosition(
  value: unknown,
): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function sanitizeProperties(
  value: unknown,
): GeoJsonProperties {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_PROPERTY_KEYS)
      .flatMap(([key, property]) => {
        const safeKey = Array.from(key)
          .filter((character) => {
            const codePoint =
              character.codePointAt(0) ?? 0;

            return codePoint >= 32 &&
              codePoint !== 127;
          })
          .join('')
          .slice(0, 80);

        if (!safeKey) {
          return [];
        }

        if (
          property === null ||
          typeof property === 'boolean' ||
          (
            typeof property === 'number' &&
            Number.isFinite(property)
          )
        ) {
          return [[safeKey, property]];
        }

        if (typeof property === 'string') {
          return [[
            safeKey,
            property.slice(0, MAX_PROPERTY_TEXT),
          ]];
        }

        return [];
      }),
  );
}

function parseGeometry(
  value: unknown,
): Geometry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.type === 'Point' &&
    validPosition(value.coordinates)
  ) {
    return {
      type: 'Point',
      coordinates: [
        value.coordinates[0],
        value.coordinates[1],
      ],
    };
  }

  if (
    value.type === 'LineString' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length >= 2 &&
    value.coordinates.every(validPosition)
  ) {
    return {
      type: 'LineString',
      coordinates: value.coordinates.map(
        (position) => [
          position[0],
          position[1],
        ],
      ),
    };
  }

  if (
    value.type === 'Polygon' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length > 0 &&
    value.coordinates.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length >= 4 &&
        ring.every(validPosition) &&
        ring[0][0] ===
          ring[ring.length - 1][0] &&
        ring[0][1] ===
          ring[ring.length - 1][1],
    )
  ) {
    return {
      type: 'Polygon',
      coordinates: value.coordinates.map(
        (ring) => ring.map(
          (position: [number, number]) => [
            position[0],
            position[1],
          ],
        ),
      ),
    };
  }

  return null;
}

function collectCandidates(
  value: unknown,
): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  if (
    value.type === 'FeatureCollection' &&
    Array.isArray(value.features)
  ) {
    return value.features;
  }

  if (value.type === 'Feature') {
    return [value];
  }

  if (
    value.type === 'Point' ||
    value.type === 'LineString' ||
    value.type === 'Polygon'
  ) {
    return [{
      type: 'Feature',
      properties: {},
      geometry: value,
    }];
  }

  return [];
}

export function previewGeoJson(
  text: string,
): GeoJsonImportPreview {
  if (
    new TextEncoder().encode(text).length >
      MAX_GEOJSON_BYTES
  ) {
    return {
      accepted: [],
      rejected: 1,
      warnings: [
        'O arquivo excede o limite de 1 MiB.',
      ],
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return {
      accepted: [],
      rejected: 1,
      warnings: ['JSON inválido.'],
    };
  }

  if (!hasSafeDepth(payload)) {
    return {
      accepted: [],
      rejected: 1,
      warnings: [
        'O documento excede a profundidade permitida.',
      ],
    };
  }

  const candidates = collectCandidates(
    payload,
  );
  const accepted: Feature<Geometry>[] = [];
  let rejected = Math.max(
    0,
    candidates.length - MAX_GEOJSON_FEATURES,
  );

  for (const candidate of candidates.slice(
    0,
    MAX_GEOJSON_FEATURES,
  )) {
    if (
      !isRecord(candidate) ||
      candidate.type !== 'Feature'
    ) {
      rejected += 1;
      continue;
    }

    const geometry = parseGeometry(
      candidate.geometry,
    );

    if (!geometry) {
      rejected += 1;
      continue;
    }

    accepted.push({
      type: 'Feature',
      properties: sanitizeProperties(
        candidate.properties,
      ),
      geometry,
    });
  }

  return {
    accepted,
    rejected,
    warnings:
      candidates.length === 0
        ? ['Nenhuma feature suportada foi encontrada.']
        : rejected > 0
          ? [`${rejected} item(ns) rejeitado(s).`]
          : [],
  };
}
