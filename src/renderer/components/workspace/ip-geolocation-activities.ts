import {
  MAP_MARKER_COLORS,
} from './map-workspace.types';
import {
  validatePublicIpAddress,
} from '../../../shared/ip-geolocation/ip-address.validation';

import type {
  CaseActivity,
  CaseActivityCreateInput,
} from '../../../shared/cases/cases.types';
import type {
  IpGeolocationProviderResult,
} from '../../../shared/ip-geolocation/ip-geolocation.types';
import type {
  IpGeolocationResult,
} from './ip-geolocation.types';
import type {
  MapMarkerColor,
} from './map-workspace.types';

export const IP_GEOLOCATION_SAVED_ACTION =
  'map-ip-geolocation-saved';

export type IpGeolocationActivityOutput = {
  id: string;
  ip: string;
  version: 'IPv4' | 'IPv6';
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  timezone: string | null;
  asn: string | null;
  organization: string | null;
  currency: string | null;
  color: MapMarkerColor;
  provider: 'ipapi.co';
  consultedAt: string;
  createdAt: string;
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

function nullableString(
  value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function isMarkerColor(
  value: unknown,
): value is MapMarkerColor {
  return (
    typeof value === 'string' &&
    MAP_MARKER_COLORS.some(
      (preset) =>
        preset.id === value,
    )
  );
}

function isValidDate(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value))
  );
}

export function createTransientIpResult(
  providerResult:
    IpGeolocationProviderResult,
  color: MapMarkerColor,
  caseId: string | null = null,
): IpGeolocationResult {
  const createdAt =
    new Date().toISOString();

  return {
    ...providerResult,
    id: crypto.randomUUID(),
    activityId: null,
    caseId,
    color,
    createdAt,
    saved: false,
  };
}

export function parseIpGeolocationActivity(
  activity: CaseActivity,
): IpGeolocationResult | null {
  if (
    activity.moduleId !==
      'map-workspace' ||
    activity.action !==
      IP_GEOLOCATION_SAVED_ACTION ||
    !isRecord(activity.output)
  ) {
    return null;
  }

  const output = activity.output;
  const id = output.id;
  const ip = output.ip;
  const latitude = output.latitude;
  const longitude = output.longitude;
  const validation =
    typeof ip === 'string'
      ? validatePublicIpAddress(ip)
      : null;
  const city = nullableString(
    output.city,
  );
  const region = nullableString(
    output.region,
  );
  const country = nullableString(
    output.country,
  );
  const countryCode = nullableString(
    output.countryCode,
  );
  const postalCode = nullableString(
    output.postalCode,
  );
  const timezone = nullableString(
    output.timezone,
  );
  const asn = nullableString(output.asn);
  const organization = nullableString(
    output.organization,
  );
  const currency = nullableString(
    output.currency,
  );

  if (
    typeof id !== 'string' ||
    !id.trim() ||
    !validation ||
    validation.valid === false ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    city === undefined ||
    region === undefined ||
    country === undefined ||
    countryCode === undefined ||
    postalCode === undefined ||
    timezone === undefined ||
    asn === undefined ||
    organization === undefined ||
    currency === undefined ||
    !isMarkerColor(output.color) ||
    output.provider !== 'ipapi.co' ||
    !isValidDate(output.consultedAt) ||
    !isValidDate(output.createdAt)
  ) {
    return null;
  }

  return {
    id,
    activityId: activity.id,
    caseId: activity.caseId,
    ip: validation.ip,
    version: validation.version,
    latitude,
    longitude,
    city,
    region,
    country,
    countryCode,
    postalCode,
    timezone,
    asn,
    organization,
    currency,
    color: output.color,
    provider: 'ipapi.co',
    consultedAt: output.consultedAt,
    createdAt: output.createdAt,
    saved: true,
  };
}

export function createIpGeolocationSavedActivity(
  caseId: string,
  result: IpGeolocationResult,
): CaseActivityCreateInput {
  const output:
    IpGeolocationActivityOutput = {
      id: result.id,
      ip: result.ip,
      version: result.version,
      latitude: result.latitude,
      longitude: result.longitude,
      city: result.city,
      region: result.region,
      country: result.country,
      countryCode: result.countryCode,
      postalCode: result.postalCode,
      timezone: result.timezone,
      asn: result.asn,
      organization:
        result.organization,
      currency: result.currency,
      color: result.color,
      provider: result.provider,
      consultedAt: result.consultedAt,
      createdAt: result.createdAt,
    };

  return {
    caseId,
    moduleId: 'map-workspace',
    action:
      IP_GEOLOCATION_SAVED_ACTION,
    title:
      `IP geolocalizado: ${result.ip}`,
    status: 'success',
    output,
    note:
      'Localização aproximada baseada em geolocalização pública de IP.',
  };
}

export function formatIpGeolocationSummary(
  result: IpGeolocationResult,
): string {
  const location = [
    result.city,
    result.region,
    result.country,
  ].filter(Boolean).join(', ');

  return [
    `IP: ${result.ip} (${result.version})`,
    `Localização aproximada: ${location || 'Não informada'}`,
    `Coordenadas aproximadas: ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`,
    `ASN: ${result.asn ?? 'Não informado'}`,
    `Organização: ${result.organization ?? 'Não informada'}`,
    `Provider: ${result.provider}`,
    `Consultado em: ${result.consultedAt}`,
  ].join('\n');
}
