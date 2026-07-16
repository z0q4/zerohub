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

export type MapWorkspaceViewState = {
  hiddenMarkerCategories:
    MapMarkerCategory[];
  layerManagerOpen: boolean;
  markerColorFilter:
    MapLayerColorFilter;
  operationalHudOpen: boolean;
};

export const DEFAULT_MAP_WORKSPACE_VIEW_STATE:
  MapWorkspaceViewState = {
    hiddenMarkerCategories: [],
    layerManagerOpen: false,
    markerColorFilter: 'all',
    operationalHudOpen: true,
  };
