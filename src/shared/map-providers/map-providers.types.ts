export const MAP_PROVIDER_VIEW_IDS = [
  'openfreemap-globe',
  'google-map-2d',
  'google-street-360',
] as const;

export type MapProviderViewId =
  typeof MAP_PROVIDER_VIEW_IDS[number];

export type GoogleEmbedMode =
  | 'map-2d'
  | 'street-360';

export type MapProviderState =
  | 'unconfigured'
  | 'ready'
  | 'loading'
  | 'error'
  | 'quota'
  | 'disabled';

export type MapProviderCapabilities = {
  supports3D: boolean;
  supportsCameraSync: boolean;
  supportsMarkers: boolean;
  supportsStreetView: boolean;
  requiresBilling: boolean;
};

export type MapProviderDefinition = {
  id: MapProviderViewId;
  label: string;
  provider: 'openfreemap' | 'google';
  modality:
    | 'globe'
    | 'map-2d'
    | 'street-360';
  capabilities:
    MapProviderCapabilities;
};

export const MAP_PROVIDER_DEFINITIONS:
  readonly MapProviderDefinition[] = [
    {
      id: 'openfreemap-globe',
      label: 'OpenFreeMap',
      provider: 'openfreemap',
      modality: 'globe',
      capabilities: {
        supports3D: true,
        supportsCameraSync: true,
        supportsMarkers: true,
        supportsStreetView: false,
        requiresBilling: false,
      },
    },
    {
      id: 'google-map-2d',
      label: 'Google Maps',
      provider: 'google',
      modality: 'map-2d',
      capabilities: {
        supports3D: false,
        supportsCameraSync: false,
        supportsMarkers: false,
        supportsStreetView: false,
        requiresBilling: true,
      },
    },
    {
      id: 'google-street-360',
      label: 'Street View 360°',
      provider: 'google',
      modality: 'street-360',
      capabilities: {
        supports3D: false,
        supportsCameraSync: false,
        supportsMarkers: false,
        supportsStreetView: true,
        requiresBilling: true,
      },
    },
  ];

export type MapProviderKeyStatus = {
  configured: boolean;
  protectedByOs: boolean;
  storageBackend: string;
};

export type GoogleEmbedRequest = {
  latitude: number;
  longitude: number;
  mode: GoogleEmbedMode;
  zoom?: number;
  heading?: number;
  pitch?: number;
  fov?: number;
};

export type GoogleEmbedSession = {
  mode: GoogleEmbedMode;
  url: string;
};
