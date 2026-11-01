export const MAP_MARKER_CATEGORIES = [
  'Alvo',
  'Infraestrutura',
  'Incidente',
  'Localização',
  'Evidência',
  'Outro',
] as const;

export const MAP_MARKER_COLORS = [
  {
    id: 'neon-green',
    label: 'Verde neon',
    value: '#78ff63',
  },
  {
    id: 'cyan',
    label: 'Ciano',
    value: '#52e5ff',
  },
  {
    id: 'yellow',
    label: 'Amarelo',
    value: '#ffe45c',
  },
  {
    id: 'orange',
    label: 'Laranja',
    value: '#ff9d4d',
  },
  {
    id: 'red',
    label: 'Vermelho',
    value: '#ff5d68',
  },
  {
    id: 'purple',
    label: 'Roxo',
    value: '#b77cff',
  },
] as const;

export type MapMarkerCategory =
  typeof MAP_MARKER_CATEGORIES[number];

export type MapMarkerColor =
  typeof MAP_MARKER_COLORS[number]['id'];

export function getMapMarkerColorValue(
  color: MapMarkerColor,
): string {
  return (
    MAP_MARKER_COLORS.find(
      (preset) =>
        preset.id === color,
    )?.value ?? '#78ff63'
  );
}

export type MapMarkerSource =
  | 'captured'
  | 'typed'
  | 'saved';

export type GeographicMarker = {
  id: string;
  activityId: string | null;
  latitude: number;
  longitude: number;
  name: string;
  category: MapMarkerCategory;
  color: MapMarkerColor;
  createdAt: string;
  saved: boolean;
  caseId: string | null;
  source: MapMarkerSource;
};

export type MapMarkerDetailsUpdate =
  Pick<
    GeographicMarker,
    'category' | 'color' | 'name'
  >;

export type RecentMapLocation = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  createdAt: string;
  caseId: string | null;
  source: MapMarkerSource;
};

export type MapMarkerFeedback = {
  message: string;
  tone:
    | 'error'
    | 'info'
    | 'success';
};

export type CoordinateParseResult =
  | {
    coordinate: [number, number];
    latitude: number;
    longitude: number;
  }
  | {
    error: string;
  };

export type MapLayerColorFilter =
  | MapMarkerColor
  | 'all';

export const MAP_OPERATIONAL_LAYER_IDS = [
  'geographic-search',
  'geographic-timeline',
  'measurements',
  'imported-geojson',
  'location-selection',
  'comparison',
] as const;

export type MapOperationalLayerId =
  typeof MAP_OPERATIONAL_LAYER_IDS[number];

export type MapCameraState = {
  bearing: number;
  latitude: number;
  longitude: number;
  pitch: number;
  zoom: number;
};

export const MAP_BASEMAP_STYLES = [
  'tactical',
  'streets-dark',
  'streets-light',
] as const;

export type MapBasemapStyle =
  typeof MAP_BASEMAP_STYLES[number];

export type DetailedBasemapStatus = 'available' | 'local' | 'loading' | 'unavailable';

export type MapWorkspaceViewState = {
  basemapStyle: MapBasemapStyle;
  camera: MapCameraState;
  hiddenMarkerCategories:
    MapMarkerCategory[];
  hiddenOperationalLayers:
    MapOperationalLayerId[];
  ipIntelligenceVisible: boolean;
  layerManagerOpen: boolean;
  markerColorFilter:
    MapLayerColorFilter;
  monochromeMode: boolean;
  operationalHudOpen: boolean;
};

export const DEFAULT_MAP_WORKSPACE_VIEW_STATE:
  MapWorkspaceViewState = {
    basemapStyle: 'tactical',
    camera: {
      bearing: 0,
      latitude: 0,
      longitude: -20,
      pitch: 0,
      zoom: 0.7,
    },
    hiddenMarkerCategories: [],
    hiddenOperationalLayers: [],
    ipIntelligenceVisible: true,
    layerManagerOpen: false,
    markerColorFilter: 'all',
    monochromeMode: true,
    operationalHudOpen: false,
  };
