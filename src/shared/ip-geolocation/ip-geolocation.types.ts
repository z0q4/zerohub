export type IpAddressVersion =
  | 'IPv4'
  | 'IPv6';

export type IpGeolocationProviderId =
  'ipapi.co';

export type IpGeolocationProviderResult = {
  ip: string;
  version: IpAddressVersion;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  postalCode: string | null;
  timezone: string | null;
  asn: string | null;
  organization: string | null;
  currency: string | null;
  provider: IpGeolocationProviderId;
  consultedAt: string;
};

export type IpGeolocationLookupRequest = {
  requestId: string;
  ip: string | null;
};

export type IpPublicLookupRequest = {
  requestId: string;
};

export type IpGeolocationErrorCode =
  | 'cancelled'
  | 'invalid-ip'
  | 'offline'
  | 'rate-limited'
  | 'timeout'
  | 'unavailable'
  | 'invalid-response';

export type IpGeolocationLookupResponse =
  | {
    ok: true;
    cached: boolean;
    result:
      IpGeolocationProviderResult;
  }
  | {
    ok: false;
    error: {
      code: IpGeolocationErrorCode;
      message: string;
    };
  };

export type IpPublicFamilyLookupResponse =
  | {
    ok: true;
    version: IpAddressVersion;
    cached: boolean;
    result: IpGeolocationProviderResult;
  }
  | {
    ok: false;
    version: IpAddressVersion;
    error: {
      code: IpGeolocationErrorCode;
      message: string;
    };
  };

export type IpPublicLookupResponse =
  | {
    ok: true;
    families:
      IpPublicFamilyLookupResponse[];
  }
  | {
    ok: false;
    error: {
      code: IpGeolocationErrorCode;
      message: string;
    };
  };
