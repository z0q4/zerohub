export const GEOGRAPHIC_SEARCH_MIN_QUERY_LENGTH = 3;
export const GEOGRAPHIC_SEARCH_MAX_QUERY_LENGTH = 160;
export const GEOGRAPHIC_SEARCH_MAX_RESULTS = 3;

export type GeographicSearchProvider =
  | 'photon'
  | 'local';

export type GeographicSearchResultType =
  | 'address'
  | 'street'
  | 'neighbourhood'
  | 'city'
  | 'region'
  | 'country'
  | 'poi'
  | 'coordinate'
  | 'unknown';

export type GeographicBoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GeographicSearchResult = {
  id: string;
  provider: GeographicSearchProvider;
  sourceId: string | null;
  name: string;
  label: string;
  type: GeographicSearchResultType;
  latitude: number;
  longitude: number;
  boundingBox: GeographicBoundingBox | null;
  country: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  attribution: string;
  approximate: true;
  fetchedAt: string;
  cached: boolean;
};

export type GeographicSearchFilter =
  | 'all'
  | 'address'
  | 'street'
  | 'neighbourhood'
  | 'city'
  | 'poi';

export type GeographicSearchRequest = {
  requestId: string;
  query: string;
  language?: string;
  filter?: GeographicSearchFilter;
  viewport?: GeographicBoundingBox | null;
  restrictToViewport?: boolean;
};

export type GeographicReverseRequest = {
  requestId: string;
  latitude: number;
  longitude: number;
  language?: string;
};

export type GeographicSearchErrorCode =
  | 'cancelled'
  | 'invalid-request'
  | 'offline'
  | 'rate-limited'
  | 'timeout'
  | 'unavailable'
  | 'invalid-response';

export type GeographicSearchError = {
  code: GeographicSearchErrorCode;
  message: string;
};

export type GeographicSearchResponse =
  | {
    ok: true;
    provider: GeographicSearchProvider;
    results: GeographicSearchResult[];
  }
  | {
    ok: false;
    error: GeographicSearchError;
  };

export type GeographicReverseResponse =
  | {
    ok: true;
    provider: GeographicSearchProvider;
    result: GeographicSearchResult;
  }
  | {
    ok: false;
    error: GeographicSearchError;
  };

export type UniversalSearchClassification =
  | {
    kind: 'empty';
  }
  | {
    kind: 'invalid';
    message: string;
  }
  | {
    kind: 'command';
    value: string;
  }
  | {
    kind: 'ip';
    value: string;
    public: boolean;
  }
  | {
    kind: 'coordinate';
    latitude: number;
    longitude: number;
  }
  | {
    kind: 'domain';
    value: string;
  }
  | {
    kind: 'geographic';
    value: string;
    ready: boolean;
  };
