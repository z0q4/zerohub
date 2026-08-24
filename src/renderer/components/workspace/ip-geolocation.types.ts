import type {
  IpAddressVersion,
  IpGeolocationErrorCode,
  IpGeolocationProviderResult,
} from '../../../shared/ip-geolocation/ip-geolocation.types';
import type {
  MapMarkerColor,
} from './map-workspace.types';

export type IpGeolocationResult =
  IpGeolocationProviderResult & {
    id: string;
    activityId: string | null;
    caseId: string | null;
    color: MapMarkerColor;
    createdAt: string;
    saved: boolean;
  };

export type IpGeolocationHistoryItem = {
  id: string;
  ip: string;
  resultId: string;
  consultedAt: string;
  version: IpAddressVersion;
};

export type IpGeolocationVersionFilter =
  | 'all'
  | IpAddressVersion;

export type IpPublicFamilyStatus = {
  version: IpAddressVersion;
  available: boolean;
  errorCode:
    IpGeolocationErrorCode | null;
  message: string;
};

export type IpGeolocationFeedback = {
  message: string;
  tone:
    | 'error'
    | 'info'
    | 'success';
};

export function hasValidIpGeolocationCoordinates(
  value: {
    latitude: unknown;
    longitude: unknown;
  },
): boolean {
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}
