import type {
  IpAddressVersion,
} from './ip-geolocation.types';

export type PublicIpValidation =
  | {
    valid: true;
    ip: string;
    version: IpAddressVersion;
  }
  | {
    valid: false;
    message: string;
  };

function parseIpv4(
  value: string,
): number[] | null {
  const parts = value.split('.');

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !/^\d{1,3}$/.test(part),
    )
  ) {
    return null;
  }

  const octets = parts.map(Number);

  return octets.every(
    (octet) =>
      octet >= 0 &&
      octet <= 255,
  )
    ? octets
    : null;
}

function expandIpv6(
  value: string,
): number[] | null {
  if (
    !value ||
    value.includes('%') ||
    value.split('::').length > 2
  ) {
    return null;
  }

  let normalized = value.toLowerCase();
  const ipv4TailMatch =
    normalized.match(
      /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/,
    );

  if (ipv4TailMatch) {
    const octets = parseIpv4(
      ipv4TailMatch[1],
    );

    if (!octets) {
      return null;
    }

    const ipv4Groups = [
      (octets[0] << 8) |
        octets[1],
      (octets[2] << 8) |
        octets[3],
    ].map(
      (group) =>
        group.toString(16),
    );
    normalized =
      normalized.slice(
        0,
        normalized.length -
          ipv4TailMatch[1].length,
      ) + ipv4Groups.join(':');
  }

  const [leftRaw, rightRaw] =
    normalized.split('::');
  const left = leftRaw
    ? leftRaw.split(':')
    : [];
  const right = rightRaw
    ? rightRaw.split(':')
    : [];

  if (
    [...left, ...right].some(
      (group) =>
        !/^[0-9a-f]{1,4}$/.test(
          group,
        ),
    )
  ) {
    return null;
  }

  const compressed =
    normalized.includes('::');
  const missing =
    8 - left.length - right.length;

  if (
    (compressed && missing < 1) ||
    (!compressed && missing !== 0)
  ) {
    return null;
  }

  return [
    ...left.map(
      (group) =>
        Number.parseInt(group, 16),
    ),
    ...Array.from(
      { length: missing },
      () => 0,
    ),
    ...right.map(
      (group) =>
        Number.parseInt(group, 16),
    ),
  ];
}

function ipv4BlockMessage(
  octets: number[],
): string | null {
  const [a, b, c] = octets;

  if (a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)) {
    return 'Endereços IP privados não podem ser consultados.';
  }

  if (a === 127) {
    return 'Endereços de loopback não podem ser consultados.';
  }

  if (a === 169 && b === 254) {
    return 'Endereços link-local não podem ser consultados.';
  }

  if (a >= 224 && a <= 239) {
    return 'Endereços multicast não podem ser consultados.';
  }

  if (
    a === 0 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 240
  ) {
    return 'Endereços reservados não podem ser consultados.';
  }

  return null;
}

function matchesIpv6Prefix(
  groups: number[],
  prefix: number[],
  bits: number,
): boolean {
  let remaining = bits;

  for (
    let index = 0;
    remaining > 0;
    index += 1
  ) {
    const comparedBits = Math.min(
      remaining,
      16,
    );
    const mask = comparedBits === 16
      ? 0xffff
      : (0xffff <<
          (16 - comparedBits)) &
        0xffff;

    if (
      (groups[index] & mask) !==
      ((prefix[index] ?? 0) & mask)
    ) {
      return false;
    }

    remaining -= comparedBits;
  }

  return true;
}

function ipv6BlockMessage(
  groups: number[],
): string | null {
  const allZero = groups.every(
    (group) => group === 0,
  );
  const loopback =
    groups.slice(0, 7).every(
      (group) => group === 0,
    ) && groups[7] === 1;

  if (allZero) {
    return 'Endereços reservados não podem ser consultados.';
  }

  if (loopback) {
    return 'Endereços de loopback não podem ser consultados.';
  }

  if (
    matchesIpv6Prefix(
      groups,
      [0xfc00],
      7,
    )
  ) {
    return 'Endereços IP privados não podem ser consultados.';
  }

  if (
    matchesIpv6Prefix(
      groups,
      [0xfe80],
      10,
    )
  ) {
    return 'Endereços link-local não podem ser consultados.';
  }

  if (
    matchesIpv6Prefix(
      groups,
      [0xff00],
      8,
    )
  ) {
    return 'Endereços multicast não podem ser consultados.';
  }

  const mappedIpv4 =
    groups.slice(0, 5).every(
      (group) => group === 0,
    ) && groups[5] === 0xffff;

  if (mappedIpv4) {
    return ipv4BlockMessage([
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ]) ??
      'Endereços reservados não podem ser consultados.';
  }

  if (
    matchesIpv6Prefix(
      groups,
      [0, 0, 0, 0, 0, 0],
      96,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x64, 0xff9b, 1],
      48,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x100],
      64,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x2001, 0x2],
      48,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x2001, 0x10],
      28,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x2001, 0x20],
      28,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x2001, 0xdb8],
      32,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x2002],
      16,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0x3fff],
      20,
    ) ||
    matchesIpv6Prefix(
      groups,
      [0xfec0],
      10,
    )
  ) {
    return 'Endereços reservados não podem ser consultados.';
  }

  return null;
}

export function validatePublicIpAddress(
  rawValue: string,
): PublicIpValidation {
  const value = rawValue
    .trim()
    .toLowerCase();

  if (
    !value ||
    value.length > 64 ||
    value === 'localhost'
  ) {
    return {
      valid: false,
      message:
        'Informe um endereço IPv4 ou IPv6 público válido.',
    };
  }

  const ipv4 = parseIpv4(value);

  if (ipv4) {
    const blocked =
      ipv4BlockMessage(ipv4);

    return blocked
      ? {
        valid: false,
        message: blocked,
      }
      : {
        valid: true,
        ip: ipv4.join('.'),
        version: 'IPv4',
      };
  }

  const ipv6 = expandIpv6(value);

  if (!ipv6) {
    return {
      valid: false,
      message:
        'Informe um endereço IPv4 ou IPv6 público válido.',
    };
  }

  const blocked =
    ipv6BlockMessage(ipv6);

  return blocked
    ? {
      valid: false,
      message: blocked,
    }
    : {
      valid: true,
      ip: ipv6.map(
        (group) =>
          group.toString(16),
      ).join(':'),
      version: 'IPv6',
    };
}
