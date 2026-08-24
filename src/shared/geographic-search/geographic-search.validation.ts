import {
  validatePublicIpAddress,
} from '../ip-geolocation/ip-address.validation';
import {
  GEOGRAPHIC_SEARCH_MAX_QUERY_LENGTH,
  GEOGRAPHIC_SEARCH_MIN_QUERY_LENGTH,
} from './geographic-search.types';

import type {
  GeographicBoundingBox,
  UniversalSearchClassification,
} from './geographic-search.types';

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;
const IPV4_SHAPE =
  /^\d{1,3}(?:\.\d{1,3}){3}$/u;
const IPV6_SHAPE =
  /^(?=.*:)[0-9a-f:.%]+$/iu;
const DECIMAL_COORDINATES =
  /^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,;]\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$/u;
const GEO_URI =
  /^geo:\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:[;,].*)?$/iu;
const DMS_COORDINATES =
  /^\s*(\d{1,2})(?:°|\s+)\s*(\d{1,2})(?:['′]|\s+)\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″])?\s*([NS])\s*[,;]?\s*(\d{1,3})(?:°|\s+)\s*(\d{1,2})(?:['′]|\s+)\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″])?\s*([EW])\s*$/iu;

export function hasValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isValidBoundingBox(
  value: unknown,
): value is GeographicBoundingBox {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const box = value as Record<
    string,
    unknown
  >;

  return (
    hasValidCoordinates(
      box.south,
      box.west,
    ) &&
    hasValidCoordinates(
      box.north,
      box.east,
    ) &&
    box.south <= box.north
  );
}

function parseCoordinateMatch(
  match: RegExpMatchArray | null,
): {
  latitude: number;
  longitude: number;
} | null {
  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  return hasValidCoordinates(
    latitude,
    longitude,
  )
    ? {
      latitude,
      longitude,
    }
    : null;
}

export function parseUniversalCoordinates(
  value: string,
): {
  latitude: number;
  longitude: number;
} | null {
  const dms = value.match(
    DMS_COORDINATES,
  );

  if (dms) {
    const toDecimal = (
      degrees: string,
      minutes: string,
      seconds: string,
      hemisphere: string,
    ): number => {
      const absolute =
        Number(degrees) +
        Number(minutes) / 60 +
        Number(seconds) / 3600;

      return /[SW]/iu.test(hemisphere)
        ? -absolute
        : absolute;
    };
    const latitude = toDecimal(
      dms[1],
      dms[2],
      dms[3],
      dms[4],
    );
    const longitude = toDecimal(
      dms[5],
      dms[6],
      dms[7],
      dms[8],
    );

    return Number(dms[2]) < 60 &&
      Number(dms[3]) < 60 &&
      Number(dms[6]) < 60 &&
      Number(dms[7]) < 60 &&
      hasValidCoordinates(
        latitude,
        longitude,
      )
      ? { latitude, longitude }
      : null;
  }

  return (
    parseCoordinateMatch(
      value.match(GEO_URI),
    ) ??
    parseCoordinateMatch(
      value.match(
        DECIMAL_COORDINATES,
      ),
    )
  );
}

export function normalizeSearchQuery(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const query = value
    .replace(/\s+/gu, ' ')
    .trim();
  const hasControlCharacter =
    Array.from(query).some(
      (character) => {
        const codePoint =
          character.codePointAt(0) ?? 0;

        return (
          codePoint < 32 ||
          codePoint === 127
        );
      },
    );

  if (
    !query ||
    query.length >
      GEOGRAPHIC_SEARCH_MAX_QUERY_LENGTH ||
    hasControlCharacter
  ) {
    return null;
  }

  return query;
}

export function classifyUniversalSearch(
  value: unknown,
): UniversalSearchClassification {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return {
      kind: 'empty',
    };
  }

  const normalized =
    normalizeSearchQuery(value);

  if (!normalized) {
    return {
      kind: 'invalid',
      message:
        'A busca está vazia, contém caracteres inválidos ou excede o limite.',
    };
  }

  if (normalized.startsWith('>')) {
    const command = normalized
      .slice(1)
      .trim()
      .toLocaleLowerCase('pt-BR');

    return command
      ? {
        kind: 'command',
        value: command,
      }
      : {
        kind: 'invalid',
        message:
          'Informe um comando depois de “>”.',
      };
  }

  if (
    IPV4_SHAPE.test(normalized) ||
    IPV6_SHAPE.test(normalized)
  ) {
    const validation =
      validatePublicIpAddress(
        normalized,
      );

    return {
      kind: 'ip',
      value:
        validation.valid
          ? validation.ip
          : normalized,
      public: validation.valid,
    };
  }

  const coordinates =
    parseUniversalCoordinates(
      normalized,
    );

  if (coordinates) {
    return {
      kind: 'coordinate',
      ...coordinates,
    };
  }

  const domain = normalized
    .toLocaleLowerCase('en-US')
    .replace(/\.$/u, '');

  if (DOMAIN_PATTERN.test(domain)) {
    return {
      kind: 'domain',
      value: domain,
    };
  }

  return {
    kind: 'geographic',
    value: normalized,
    ready:
      normalized.length >=
      GEOGRAPHIC_SEARCH_MIN_QUERY_LENGTH,
  };
}
