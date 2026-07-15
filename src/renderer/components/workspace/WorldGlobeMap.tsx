import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import maplibregl, {
  type GeoJSONSourceSpecification,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import admin1DataRaw from '../../assets/map/admin1.geojson?raw';
import countriesDataRaw from '../../assets/map/countries.geojson?raw';
import populatedPlacesDataRaw from '../../assets/map/populated-places.geojson?raw';

import {
  useCaseWorkspace,
} from '../../features/cases/CaseWorkspaceContext';

import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
  WorkspaceMapMarkerPanel,
  formatCoordinates,
  parseCoordinateInput,
  type GeographicMarker,
  type MapMarkerCategory,
  type MapMarkerColor,
  type MapMarkerFeedback,
  type MapMarkerSource,
  type RecentMapLocation,
} from './WorkspaceMapMarkerPanel';

import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';
import type {
  CaseActivity,
} from '../../../shared/cases/cases.types';

type MapLabelKind =
  | 'country'
  | 'admin1'
  | 'city';

type MapLabel = {
  id: string;
  kind: MapLabelKind;
  name: string;
  coordinate: [number, number];
  minZoom: number;
  rank: number;
};

type WorldGlobeMapProps = {
  markerCount: number;
  modulePanelOpen: boolean;
  resetSignal: number;
};

type MarkerActionHandlers = {
  center(markerId: string): void;
  copy(markerId: string): void;
  remove(markerId: string): void;
  select(markerId: string): void;
};

type MapMarkerView = {
  marker: maplibregl.Marker;
  element: HTMLDivElement;
  name: HTMLElement;
  metadata: HTMLElement;
  coordinates: HTMLElement;
  status: HTMLElement;
  copyButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  cleanup(): void;
};

type MapViewportPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const INITIAL_CENTER: [number, number] = [
  -20,
  0,
];
const INITIAL_ZOOM = 0.7;
const LOCATION_ZOOM = 5.2;
const ROTATION_DEGREES_PER_SECOND = 4.5;
const AUTO_ROTATION_STEP_DEGREES = 45;
const AUTO_ROTATION_STEP_DURATION_MS =
  (AUTO_ROTATION_STEP_DEGREES /
    ROTATION_DEGREES_PER_SECOND) *
  1000;
const COPY_FEEDBACK_MS = 1500;
const MAX_TRANSIENT_RECENT_LOCATIONS =
  20;

const countriesData =
  JSON.parse(
    countriesDataRaw,
  ) as FeatureCollection;
const admin1Data =
  JSON.parse(
    admin1DataRaw,
  ) as FeatureCollection;
const populatedPlacesData =
  JSON.parse(
    populatedPlacesDataRaw,
  ) as FeatureCollection;

function asFeatureCollection(
  value: unknown,
): FeatureCollection {
  return value as FeatureCollection;
}

function calculateMapViewportPadding(
  container: HTMLElement,
): MapViewportPadding {
  const workspace =
    container.closest<HTMLElement>(
      '.mapWorkspaceShell',
    );

  if (!workspace) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }

  const bounds =
    container.getBoundingClientRect();
  const rail =
    workspace.querySelector<HTMLElement>(
      '.compactModuleRail',
    );
  const railBounds =
    rail?.getBoundingClientRect();
  const railOverlapsViewport =
    railBounds !== undefined &&
    railBounds.width > 0 &&
    railBounds.height > 0 &&
    railBounds.right > bounds.left &&
    railBounds.left < bounds.right &&
    railBounds.bottom > bounds.top &&
    railBounds.top < bounds.bottom;
  const availableLeft =
    railOverlapsViewport
      ? Math.min(
        bounds.right,
        Math.max(
          bounds.left,
          railBounds.right,
        ),
      )
      : bounds.left;

  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: availableLeft - bounds.left,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isMarkerCategory(
  value: unknown,
): value is MapMarkerCategory {
  return (
    typeof value === 'string' &&
    MAP_MARKER_CATEGORIES.includes(
      value as MapMarkerCategory,
    )
  );
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

function markerFromActivity(
  activity: CaseActivity,
): GeographicMarker | null {
  if (
    activity.moduleId !==
      'map-workspace' ||
    activity.action !==
      'map-marker-saved' ||
    !isRecord(activity.output)
  ) {
    return null;
  }

  const output = activity.output;
  const {
    id,
    latitude,
    longitude,
    name,
    category,
    color,
    createdAt,
  } = output;

  if (
    typeof id !== 'string' ||
    !id ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof name !== 'string' ||
    !name.trim() ||
    !isMarkerCategory(category) ||
    !isMarkerColor(color) ||
    typeof createdAt !== 'string' ||
    !createdAt ||
    !Number.isFinite(
      Date.parse(createdAt),
    )
  ) {
    return null;
  }

  return {
    id,
    latitude,
    longitude,
    name: name.trim(),
    category,
    color,
    createdAt,
    saved: true,
    caseId: activity.caseId,
    source: 'saved',
  };
}

function markerColorValue(
  color: MapMarkerColor,
): string {
  return (
    MAP_MARKER_COLORS.find(
      (preset) =>
        preset.id === color,
    )?.value ?? '#78ff63'
  );
}

function createMapMarkerView(
  markerData: GeographicMarker,
  actionsRef:
    React.MutableRefObject<
      MarkerActionHandlers
    >,
): MapMarkerView {
  const element =
    document.createElement('div');
  const pulse =
    document.createElement('span');
  const glow =
    document.createElement('span');
  const core =
    document.createElement('span');
  const tooltip =
    document.createElement('div');
  const name =
    document.createElement('strong');
  const metadata =
    document.createElement('span');
  const coordinates =
    document.createElement('code');
  const status =
    document.createElement('small');
  const actionList =
    document.createElement('div');
  const centerButton =
    document.createElement('button');
  const copyButton =
    document.createElement('button');
  const removeButton =
    document.createElement('button');

  element.className =
    'coordinateLocationMarker';
  element.tabIndex = 0;
  element.setAttribute('role', 'group');
  pulse.className =
    'coordinateLocationMarkerPulse';
  glow.className =
    'coordinateLocationMarkerGlow';
  core.className =
    'coordinateLocationMarkerCore';
  tooltip.className =
    'coordinateLocationMarkerTooltip';
  actionList.className =
    'coordinateLocationMarkerActions';
  centerButton.type = 'button';
  centerButton.textContent =
    'Centralizar';
  centerButton.setAttribute(
    'aria-label',
    'Centralizar câmera neste marcador',
  );
  copyButton.type = 'button';
  copyButton.textContent = 'Copiar';
  copyButton.setAttribute(
    'aria-label',
    'Copiar coordenadas deste marcador',
  );
  removeButton.type = 'button';
  removeButton.textContent = 'Remover';
  removeButton.setAttribute(
    'aria-label',
    'Remover marcador transitório',
  );
  actionList.append(
    centerButton,
    copyButton,
    removeButton,
  );
  tooltip.append(
    name,
    metadata,
    coordinates,
    status,
    actionList,
  );
  element.append(
    pulse,
    glow,
    core,
    tooltip,
  );

  const handleSelect = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
    actionsRef.current.select(
      markerData.id,
    );
  };
  const handleKeyDown = (
    event: KeyboardEvent,
  ): void => {
    if (
      event.key !== 'Enter' &&
      event.key !== ' '
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    actionsRef.current.select(
      markerData.id,
    );
  };
  const handleCenter = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
    actionsRef.current.center(
      markerData.id,
    );
  };
  const handleCopy = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
    actionsRef.current.copy(
      markerData.id,
    );
  };
  const handleRemove = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
    actionsRef.current.remove(
      markerData.id,
    );
  };

  element.addEventListener(
    'click',
    handleSelect,
  );
  element.addEventListener(
    'keydown',
    handleKeyDown,
  );
  centerButton.addEventListener(
    'click',
    handleCenter,
  );
  copyButton.addEventListener(
    'click',
    handleCopy,
  );
  removeButton.addEventListener(
    'click',
    handleRemove,
  );

  return {
    marker:
      new maplibregl.Marker({
        anchor: 'center',
        element,
        opacityWhenCovered: 0,
        subpixelPositioning: true,
      }),
    element,
    name,
    metadata,
    coordinates,
    status,
    copyButton,
    removeButton,
    cleanup: () => {
      element.removeEventListener(
        'click',
        handleSelect,
      );
      element.removeEventListener(
        'keydown',
        handleKeyDown,
      );
      centerButton.removeEventListener(
        'click',
        handleCenter,
      );
      copyButton.removeEventListener(
        'click',
        handleCopy,
      );
      removeButton.removeEventListener(
        'click',
        handleRemove,
      );
    },
  };
}

function updateMapMarkerView(
  view: MapMarkerView,
  marker: GeographicMarker,
  copied: boolean,
): void {
  const coordinateText =
    formatCoordinates(
      marker.latitude,
      marker.longitude,
    );
  const displayName =
    marker.name.trim() ||
    'Marcador sem nome';

  view.element.style.setProperty(
    '--marker-color',
    markerColorValue(marker.color),
  );
  view.element.setAttribute(
    'aria-label',
    `${displayName}, ${marker.category}, ${coordinateText}`,
  );
  view.name.textContent = displayName;
  view.metadata.textContent =
    marker.category;
  view.coordinates.textContent =
    coordinateText;
  view.status.textContent =
    marker.saved
      ? 'Salvo no perfil'
      : 'Transitório';
  view.copyButton.textContent =
    copied
      ? 'Copiado'
      : 'Copiar';
  view.removeButton.hidden =
    marker.saved;
  view.marker.setLngLat([
    marker.longitude,
    marker.latitude,
  ]);
}

function createMapStyle():
  StyleSpecification {
  return {
    version: 8,
    sources: {
      countries: {
        type: 'geojson',
        data:
          countriesData as GeoJSONSourceSpecification['data'],
      },
      admin1: {
        type: 'geojson',
        data:
          admin1Data as GeoJSONSourceSpecification['data'],
      },
      places: {
        type: 'geojson',
        data:
          populatedPlacesData as GeoJSONSourceSpecification['data'],
      },
      labels: {
        type: 'geojson',
        data:
          buildLabelData() as GeoJSONSourceSpecification['data'],
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#030303',
        },
      },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            '#101112',
            5,
            '#141516',
          ],
          'fill-opacity': 0.98,
        },
      },
      {
        id: 'countries-border',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color':
            'rgba(255,255,255,0.16)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.45,
            5,
            1.2,
          ],
          'line-opacity': 0.85,
        },
      },
      {
        id: 'admin1-border',
        type: 'line',
        source: 'admin1',
        minzoom: 2.8,
        paint: {
          'line-color':
            'rgba(255,255,255,0.08)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2.8,
            0.35,
            7,
            0.9,
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2.8,
            0,
            4,
            0.72,
          ],
        },
      },
      {
        id: 'city-points',
        type: 'circle',
        source: 'places',
        minzoom: 4.8,
        paint: {
          'circle-color':
            'rgba(255,255,255,0.72)',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.8,
            1.1,
            8,
            2.4,
          ],
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.8,
            0.35,
            8,
            0.72,
          ],
        },
      },
      {
        id: 'map-labels',
        type: 'symbol',
        source: 'labels',
        minzoom: 1,
        layout: {
          'symbol-sort-key': [
            '+',
            [
              '*',
              ['get', 'minZoom'],
              10,
            ],
            ['get', 'rank'],
          ],
          'text-field': [
            'step',
            ['zoom'],
            '',
            1,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                1,
              ],
              ['get', 'name'],
              '',
            ],
            2,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                2,
              ],
              ['get', 'name'],
              '',
            ],
            3,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                3,
              ],
              ['get', 'name'],
              '',
            ],
            4,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                4,
              ],
              ['get', 'name'],
              '',
            ],
            5,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                5,
              ],
              ['get', 'name'],
              '',
            ],
            6,
            [
              'case',
              [
                '<=',
                ['get', 'minZoom'],
                6,
              ],
              ['get', 'name'],
              '',
            ],
            8,
            ['get', 'name'],
          ],
          'text-font': [
            'Inter',
            'Segoe UI',
            'Roboto',
            'Helvetica Neue',
            'Arial',
            'sans-serif',
          ],
          'text-size': [
            'match',
            ['get', 'kind'],
            'country',
            10,
            'admin1',
            8,
            8,
          ],
          'text-max-width': 12,
          'text-line-height': 1.15,
          'text-padding': 7,
          'text-variable-anchor': [
            'center',
            'top',
            'bottom',
            'left',
            'right',
          ],
          'text-radial-offset': 0.35,
          'text-justify': 'auto',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'kind'],
            'country',
            'rgba(255,255,255,0.72)',
            'admin1',
            'rgba(255,255,255,0.52)',
            'rgba(255,255,255,0.62)',
          ],
          'text-halo-color':
            'rgba(0,0,0,0.82)',
          'text-halo-width': 1,
          'text-halo-blur': 0.4,
        },
      },
    ],
  };
}

function coordinateDepth(
  coordinates: unknown,
): coordinates is Position {
  return (
    Array.isArray(coordinates) &&
    typeof coordinates[0] ===
      'number' &&
    typeof coordinates[1] === 'number'
  );
}

function collectPositions(
  coordinates: unknown,
  positions: Position[],
): void {
  if (coordinateDepth(coordinates)) {
    positions.push(coordinates);
    return;
  }

  if (!Array.isArray(coordinates)) {
    return;
  }

  for (const item of coordinates) {
    collectPositions(
      item,
      positions,
    );
  }
}

function geometryCentroid(
  geometry: Geometry | null,
): [number, number] | null {
  if (!geometry) {
    return null;
  }

  if (geometry.type === 'Point') {
    const [
      longitude,
      latitude,
    ] = geometry.coordinates;

    return [
      longitude,
      latitude,
    ];
  }

  if (
    geometry.type !== 'Polygon' &&
    geometry.type !== 'MultiPolygon'
  ) {
    return null;
  }

  const positions: Position[] = [];
  collectPositions(
    (
      geometry as Polygon | MultiPolygon
    ).coordinates,
    positions,
  );

  if (positions.length === 0) {
    return null;
  }

  const totals =
    positions.reduce(
      (accumulator, position) => ({
        longitude:
          accumulator.longitude +
          Number(position[0]),
        latitude:
          accumulator.latitude +
          Number(position[1]),
      }),
      {
        longitude: 0,
        latitude: 0,
      },
    );

  return [
    totals.longitude /
      positions.length,
    totals.latitude /
      positions.length,
  ];
}

function propertyString(
  feature: Feature,
  keys: string[],
): string | null {
  const properties =
    feature.properties ?? {};

  for (const key of keys) {
    const value = properties[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function propertyNumber(
  feature: Feature,
  keys: string[],
  fallback: number,
): number {
  const properties =
    feature.properties ?? {};

  for (const key of keys) {
    const value = properties[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function buildLabels(): MapLabel[] {
  const countries =
    asFeatureCollection(
      countriesData,
    );
  const admin1 =
    asFeatureCollection(
      admin1Data,
    );
  const places =
    asFeatureCollection(
      populatedPlacesData,
    );

  const countryLabels =
    countries.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['LABELRANK'],
            8,
          );
        const coordinate =
          geometryCentroid(
            feature.geometry,
          );
        const name =
          propertyString(
            feature,
            [
              'NAME_PT',
              'ADMIN',
              'NAME',
            ],
          );

        if (
          !coordinate ||
          !name ||
          rank > 4
        ) {
          return null;
        }

        return {
          id: `country-${index}`,
          kind: 'country' as const,
          name,
          coordinate,
          minZoom:
            rank <= 2
              ? 1
              : rank === 3
                ? 2
                : 3,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      );

  const adminLabels =
    admin1.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['scalerank'],
            9,
          );
        const coordinate =
          geometryCentroid(
            feature.geometry,
          );
        const name =
          propertyString(
            feature,
            ['name_pt', 'name'],
          );

        if (
          !coordinate ||
          !name ||
          rank > 5
        ) {
          return null;
        }

        return {
          id: `admin-${index}`,
          kind: 'admin1' as const,
          name,
          coordinate,
          minZoom: 4,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      )
      .slice(0, 420);

  const cityLabels =
    places.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['SCALERANK'],
            9,
          );
        const geometry =
          feature.geometry as Point | null;

        if (
          !geometry ||
          geometry.type !== 'Point' ||
          rank > 7
        ) {
          return null;
        }

        const name =
          propertyString(
            feature,
            ['NAME', 'NAMEASCII'],
          );

        if (!name) {
          return null;
        }

        const [
          longitude,
          latitude,
        ] = geometry.coordinates;

        return {
          id: `city-${index}`,
          kind: 'city' as const,
          name,
          coordinate: [
            longitude,
            latitude,
          ] as [number, number],
          minZoom:
            rank <= 2
              ? 5
              : rank <= 5
                ? 6
                : 8,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      )
      .slice(0, 700);

  return [
    ...countryLabels,
    ...adminLabels,
    ...cityLabels,
  ];
}

function buildLabelData():
  FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: buildLabels().map(
      (label): Feature<Point> => ({
        type: 'Feature',
        id: label.id,
        properties: {
          kind: label.kind,
          name: label.name,
          minZoom: label.minZoom,
          rank: label.rank,
        },
        geometry: {
          type: 'Point',
          coordinates:
            label.coordinate,
        },
      }),
    ),
  };
}

export function WorldGlobeMap({
  markerCount,
  modulePanelOpen,
  resetSignal,
}: WorldGlobeMapProps) {
  const {
    activeCase,
    addActivity,
    loading: caseLoading,
    mutating: caseMutating,
  } = useCaseWorkspace();
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const mapRef =
    useRef<MapLibreMap | null>(null);
  const mapMarkerViewsRef =
    useRef(
      new Map<string, MapMarkerView>(),
    );
  const visibleMarkersRef =
    useRef<GeographicMarker[]>([]);
  const captureCoordinateRef =
    useRef<
      (
        latitude: number,
        longitude: number,
      ) => void
    >(
      () => undefined,
    );
  const markerActionsRef =
    useRef<MarkerActionHandlers>({
      center: () => undefined,
      copy: () => undefined,
      remove: () => undefined,
      select: () => undefined,
    });
  const copyFeedbackTimerRef =
    useRef<number | null>(null);
  const savingMarkerRef =
    useRef(false);
  const updateViewportPaddingRef =
    useRef<() => void>(
      () => undefined,
    );
  const mapReadyRef =
    useRef(false);
  const viewportFrameRef =
    useRef<number | null>(null);
  const rotationResumeFrameRef =
    useRef<number | null>(null);
  const rotationEnabledRef =
    useRef(false);
  const startAutoRotationRef =
    useRef<() => void>(
      () => undefined,
    );
  const reducedMotionRef =
    useRef(false);
  const [
    rotationEnabled,
    setRotationEnabled,
  ] = useState(false);
  const [
    monochromeMode,
    setMonochromeMode,
  ] = useState(false);
  const [
    coordinatePanelOpen,
    setCoordinatePanelOpen,
  ] = useState(true);
  const [
    mapReady,
    setMapReady,
  ] = useState(false);
  const [
    coordinateInput,
    setCoordinateInput,
  ] = useState('');
  const [
    locatorFeedback,
    setLocatorFeedback,
  ] =
    useState<
      MapMarkerFeedback | null
    >(null);
  const [
    editorFeedback,
    setEditorFeedback,
  ] =
    useState<
      MapMarkerFeedback | null
    >(null);
  const [
    transientMarkers,
    setTransientMarkers,
  ] = useState<GeographicMarker[]>([]);
  const [
    transientRecentLocations,
    setTransientRecentLocations,
  ] = useState<RecentMapLocation[]>([]);
  const [
    selectedMarkerId,
    setSelectedMarkerId,
  ] = useState<string | null>(null);
  const [
    copiedTarget,
    setCopiedTarget,
  ] = useState<string | null>(null);
  const [
    savingMarker,
    setSavingMarker,
  ] = useState(false);

  const activeCaseId =
    activeCase?.id ?? null;
  const persistentMarkers =
    useMemo(() => {
      if (!activeCase) {
        return [];
      }

      const seenIds =
        new Set<string>();
      const markers:
        GeographicMarker[] = [];

      for (
        const activity of
        activeCase.activities
      ) {
        const marker =
          markerFromActivity(
            activity,
          );

        if (
          !marker ||
          seenIds.has(marker.id)
        ) {
          continue;
        }

        seenIds.add(marker.id);
        markers.push(marker);
      }

      return markers;
    }, [activeCase]);
  const visibleMarkers =
    useMemo(() => {
      const persistentIds =
        new Set(
          persistentMarkers.map(
            (marker) => marker.id,
          ),
        );

      return [
        ...persistentMarkers,
        ...transientMarkers.filter(
          (marker) =>
            marker.caseId ===
              activeCaseId &&
            !persistentIds.has(
              marker.id,
            ),
        ),
      ];
    }, [
      activeCaseId,
      persistentMarkers,
      transientMarkers,
    ]);
  const selectedMarker =
    useMemo(
      () =>
        visibleMarkers.find(
          (marker) =>
            marker.id ===
            selectedMarkerId,
        ) ?? null,
      [
        selectedMarkerId,
        visibleMarkers,
      ],
    );
  const recentLocations =
    useMemo(() => {
      const savedLocations:
        RecentMapLocation[] =
        persistentMarkers.map(
          (marker) => ({
            id:
              `saved-${marker.id}`,
            latitude:
              marker.latitude,
            longitude:
              marker.longitude,
            name: marker.name,
            createdAt:
              marker.createdAt,
            caseId: marker.caseId,
            source: 'saved',
          }),
        );
      const sessionLocations =
        transientRecentLocations.filter(
          (location) =>
            location.caseId ===
            activeCaseId,
        );

      return [
        ...savedLocations,
        ...sessionLocations,
      ]
        .sort(
          (left, right) =>
            Date.parse(
              right.createdAt,
            ) -
            Date.parse(
              left.createdAt,
            ),
        )
        .slice(
          0,
          MAX_TRANSIENT_RECENT_LOCATIONS,
        );
    }, [
      activeCaseId,
      persistentMarkers,
      transientRecentLocations,
    ]);

  const startAutoRotation =
    useCallback(() => {
      const map = mapRef.current;

      if (
        !map ||
        !mapReadyRef.current ||
        !rotationEnabledRef.current ||
        map.isMoving()
      ) {
        return;
      }

      const center = map.getCenter();

      map.easeTo(
        {
          center: [
            center.lng +
              AUTO_ROTATION_STEP_DEGREES,
            center.lat,
          ],
          duration:
            AUTO_ROTATION_STEP_DURATION_MS,
          easing: (progress) => progress,
          essential: true,
        },
        {
          autoRotate: true,
        },
      );
    }, []);

  const updateViewportPadding =
    useCallback(() => {
      const map = mapRef.current;
      const container =
        containerRef.current;

      if (
        !map ||
        !container ||
        !mapReadyRef.current
      ) {
        return;
      }

      map.resize();

      const nextPadding =
        calculateMapViewportPadding(
          container,
        );
      const currentPadding =
        map.getPadding();
      const paddingChanged =
        Math.abs(
          currentPadding.top -
            nextPadding.top,
        ) > 0.5 ||
        Math.abs(
          currentPadding.right -
            nextPadding.right,
        ) > 0.5 ||
        Math.abs(
          currentPadding.bottom -
            nextPadding.bottom,
        ) > 0.5 ||
        Math.abs(
          currentPadding.left -
            nextPadding.left,
        ) > 0.5;

      if (paddingChanged) {
        map.setPadding(nextPadding);
      }
    }, []);

  const recenterMap =
    useCallback(() => {
      const map = mapRef.current;

      if (
        !map ||
        !mapReadyRef.current
      ) {
        return;
      }

      updateViewportPadding();
      map.easeTo({
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: 0,
        bearing: 0,
        duration:
          reducedMotionRef.current
            ? 0
            : 700,
      });
    }, [updateViewportPadding]);

  const centerCoordinates =
    useCallback(
      (
        latitude: number,
        longitude: number,
      ): void => {
        const map = mapRef.current;

        if (
          !map ||
          !mapReadyRef.current
        ) {
          return;
        }

        map.flyTo({
          center: [
            longitude,
            latitude,
          ],
          zoom: Math.max(
            map.getZoom(),
            LOCATION_ZOOM,
          ),
          speed: 1.15,
          curve: 1.35,
          essential: false,
        });
      },
      [],
    );

  const copyCoordinates =
    useCallback(
      (
        latitude: number,
        longitude: number,
        target: string,
      ): void => {
        try {
          window.zeroHub.clipboard
            .writeText(
              formatCoordinates(
                latitude,
                longitude,
              ),
            );
          setCopiedTarget(target);

          if (
            copyFeedbackTimerRef
              .current !== null
          ) {
            window.clearTimeout(
              copyFeedbackTimerRef
                .current,
            );
          }

          copyFeedbackTimerRef.current =
            window.setTimeout(() => {
              setCopiedTarget(null);
              copyFeedbackTimerRef.current =
                null;
            }, COPY_FEEDBACK_MS);
        } catch (unknownError) {
          setLocatorFeedback({
            message:
              unknownError instanceof Error
                ? unknownError.message
                : 'Não foi possível copiar as coordenadas.',
            tone: 'error',
          });
        }
      },
      [],
    );

  const addTransientMarker =
    useCallback(
      (
        latitude: number,
        longitude: number,
        source: Exclude<
          MapMarkerSource,
          'saved'
        >,
      ): GeographicMarker => {
        const id =
          window.crypto.randomUUID();
        const createdAt =
          new Date().toISOString();
        const name =
          source === 'captured'
            ? 'Coordenada capturada'
            : 'Coordenada digitada';
        const marker:
          GeographicMarker = {
          id,
          latitude,
          longitude,
          name,
          category: 'Localização',
          color: 'neon-green',
          createdAt,
          saved: false,
          caseId: activeCaseId,
          source,
        };

        setTransientMarkers(
          (current) => [
            marker,
            ...current,
          ],
        );
        setTransientRecentLocations(
          (current) => [
            {
              id:
                `recent-${id}`,
              latitude,
              longitude,
              name,
              createdAt,
              caseId: activeCaseId,
              source,
            },
            ...current,
          ].slice(
            0,
            MAX_TRANSIENT_RECENT_LOCATIONS,
          ),
        );
        setSelectedMarkerId(id);
        setCoordinateInput(
          formatCoordinates(
            latitude,
            longitude,
          ),
        );
        setEditorFeedback(null);
        setLocatorFeedback({
          message:
            source === 'captured'
              ? 'Coordenada capturada.'
              : 'Coordenada localizada.',
          tone: 'success',
        });

        return marker;
      },
      [activeCaseId],
    );

  const locateCoordinate =
    useCallback(() => {
      const parsed =
        parseCoordinateInput(
          coordinateInput,
        );

      if ('error' in parsed) {
        setLocatorFeedback({
          message: parsed.error,
          tone: 'error',
        });
        return;
      }

      if (!mapReadyRef.current) {
        setLocatorFeedback({
          message:
            'O globo ainda está carregando.',
          tone: 'error',
        });
        return;
      }

      addTransientMarker(
        parsed.latitude,
        parsed.longitude,
        'typed',
      );
      centerCoordinates(
        parsed.latitude,
        parsed.longitude,
      );
    }, [
      addTransientMarker,
      centerCoordinates,
      coordinateInput,
    ]);

  const captureCoordinate =
    useCallback(
      (
        latitude: number,
        longitude: number,
      ): void => {
        addTransientMarker(
          latitude,
          longitude,
          'captured',
        );
      },
      [addTransientMarker],
    );

  const removeTransientMarker =
    useCallback(
      (markerId: string): void => {
        const marker =
          transientMarkers.find(
            (item) =>
              item.id === markerId,
          );

        if (!marker) {
          return;
        }

        setTransientMarkers(
          (current) =>
            current.filter(
              (item) =>
                item.id !== markerId,
            ),
        );
        setSelectedMarkerId(
          (current) =>
            current === markerId
              ? null
              : current,
        );
        setEditorFeedback({
          message:
            'Marcador transitório removido.',
          tone: 'info',
        });
      },
      [transientMarkers],
    );

  const updateTransientMarker =
    useCallback(
      (
        markerId: string,
        update: Partial<
          Pick<
            GeographicMarker,
            | 'category'
            | 'color'
            | 'name'
          >
        >,
      ): void => {
        setTransientMarkers(
          (current) =>
            current.map(
              (marker) =>
                marker.id === markerId &&
                !marker.saved
                  ? {
                    ...marker,
                    ...update,
                  }
                  : marker,
            ),
        );
        setEditorFeedback(null);
      },
      [],
    );

  const saveSelectedMarker =
    useCallback(async (): Promise<void> => {
      if (
        !selectedMarker ||
        selectedMarker.saved ||
        savingMarkerRef.current
      ) {
        return;
      }

      if (!activeCase) {
        setEditorFeedback({
          message:
            'Selecione um perfil ativo antes de salvar o marcador.',
          tone: 'error',
        });
        return;
      }

      const name =
        selectedMarker.name.trim();

      if (!name) {
        setEditorFeedback({
          message:
            'Informe um nome para o marcador.',
          tone: 'error',
        });
        return;
      }

      if (
        !isMarkerCategory(
          selectedMarker.category,
        ) ||
        !isMarkerColor(
          selectedMarker.color,
        )
      ) {
        setEditorFeedback({
          message:
            'Selecione categoria e cor válidas.',
          tone: 'error',
        });
        return;
      }

      if (
        persistentMarkers.some(
          (marker) =>
            marker.id ===
            selectedMarker.id,
        )
      ) {
        setEditorFeedback({
          message:
            'Este marcador já está salvo no perfil.',
          tone: 'info',
        });
        return;
      }

      const targetCase = {
        id: activeCase.id,
        name: activeCase.name,
      };
      const output = {
        id: selectedMarker.id,
        latitude:
          selectedMarker.latitude,
        longitude:
          selectedMarker.longitude,
        name,
        category:
          selectedMarker.category,
        color: selectedMarker.color,
        createdAt:
          selectedMarker.createdAt,
      };

      savingMarkerRef.current = true;
      setSavingMarker(true);
      setEditorFeedback(null);

      try {
        await addActivity({
          caseId: targetCase.id,
          moduleId: 'map-workspace',
          action: 'map-marker-saved',
          title:
            `Marcador geográfico: ${name}`,
          status: 'success',
          output,
        });

        setTransientMarkers(
          (current) =>
            current.filter(
              (marker) =>
                marker.id !==
                selectedMarker.id,
            ),
        );
        setEditorFeedback({
          message:
            `Marcador salvo em ${targetCase.name}.`,
          tone: 'success',
        });
      } catch (unknownError) {
        setEditorFeedback({
          message:
            unknownError instanceof Error
              ? unknownError.message
              : 'Não foi possível salvar o marcador no perfil.',
          tone: 'error',
        });
      } finally {
        savingMarkerRef.current = false;
        setSavingMarker(false);
      }
    }, [
      activeCase,
      addActivity,
      persistentMarkers,
      selectedMarker,
    ]);

  const findVisibleMarker =
    useCallback(
      (
        markerId: string,
      ): GeographicMarker | null =>
        visibleMarkersRef.current.find(
          (marker) =>
            marker.id === markerId,
        ) ?? null,
      [],
    );

  const centerMarkerById =
    useCallback(
      (markerId: string): void => {
        const marker =
          findVisibleMarker(markerId);

        if (marker) {
          centerCoordinates(
            marker.latitude,
            marker.longitude,
          );
        }
      },
      [
        centerCoordinates,
        findVisibleMarker,
      ],
    );

  const copyMarkerById =
    useCallback(
      (markerId: string): void => {
        const marker =
          findVisibleMarker(markerId);

        if (marker) {
          copyCoordinates(
            marker.latitude,
            marker.longitude,
            `marker:${marker.id}`,
          );
        }
      },
      [
        copyCoordinates,
        findVisibleMarker,
      ],
    );

  const copyCoordinateInput =
    useCallback(() => {
      const parsed =
        parseCoordinateInput(
          coordinateInput,
        );

      if ('error' in parsed) {
        setLocatorFeedback({
          message: parsed.error,
          tone: 'error',
        });
        return;
      }

      copyCoordinates(
        parsed.latitude,
        parsed.longitude,
        'main',
      );
    }, [
      coordinateInput,
      copyCoordinates,
    ]);

  const reuseRecentLocation =
    useCallback(
      (
        location:
          RecentMapLocation,
      ): void => {
        setCoordinateInput(
          formatCoordinates(
            location.latitude,
            location.longitude,
          ),
        );
        setLocatorFeedback({
          message:
            'Coordenada reutilizada no formulário.',
          tone: 'info',
        });
      },
      [],
    );

  visibleMarkersRef.current =
    visibleMarkers;
  startAutoRotationRef.current =
    startAutoRotation;
  updateViewportPaddingRef.current =
    updateViewportPadding;
  captureCoordinateRef.current =
    captureCoordinate;
  markerActionsRef.current = {
    center: centerMarkerById,
    copy: copyMarkerById,
    remove: removeTransientMarker,
    select: setSelectedMarkerId,
  };

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    return () => {
      if (
        copyFeedbackTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          copyFeedbackTimerRef.current,
        );
      }
    };
  }, []);

  useEffect(() => {
    const container =
      containerRef.current;

    if (
      !container ||
      mapRef.current
    ) {
      return undefined;
    }

    const map =
      new maplibregl.Map({
        container,
        style: createMapStyle(),
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 0.25,
        maxZoom: 10,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        renderWorldCopies: false,
        cooperativeGestures: false,
      });

    mapRef.current = map;

    const scheduleViewportUpdate = () => {
      if (
        viewportFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          viewportFrameRef.current,
        );
      }

      viewportFrameRef.current =
        window.requestAnimationFrame(() => {
          viewportFrameRef.current = null;
          updateViewportPaddingRef.current();
        });
    };

    const handleReady = () => {
      map.setProjection({
        type: 'globe',
      });
      mapReadyRef.current = true;
      setMapReady(true);
      scheduleViewportUpdate();
    };

    const handleMoveEnd = () => {
      if (
        rotationResumeFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          rotationResumeFrameRef.current,
        );
      }

      rotationResumeFrameRef.current =
        window.requestAnimationFrame(() => {
          rotationResumeFrameRef.current =
            null;
          startAutoRotationRef.current();
        });
    };

    const handleMapClick = (
      event: MapMouseEvent,
    ): void => {
      if (
        !event.originalEvent.ctrlKey ||
        event.originalEvent.button !== 0 ||
        !Number.isFinite(
          event.lngLat.lat,
        ) ||
        !Number.isFinite(
          event.lngLat.lng,
        ) ||
        event.lngLat.lat < -90 ||
        event.lngLat.lat > 90 ||
        event.lngLat.lng < -180 ||
        event.lngLat.lng > 180
      ) {
        return;
      }

      captureCoordinateRef.current(
        event.lngLat.lat,
        event.lngLat.lng,
      );
    };

    map.on('load', handleReady);
    map.on('click', handleMapClick);
    map.on('moveend', handleMoveEnd);

    const resizeObserver =
      new ResizeObserver(() => {
        if (!mapReadyRef.current) {
          return;
        }

        scheduleViewportUpdate();
      });
    resizeObserver.observe(container);
    const workspace =
      container.closest<HTMLElement>(
        '.mapWorkspaceShell',
      );
    const rail =
      workspace?.querySelector<HTMLElement>(
        '.compactModuleRail',
      );

    if (rail) {
      resizeObserver.observe(rail);
    }

    return () => {
      if (
        viewportFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          viewportFrameRef.current,
        );
        viewportFrameRef.current = null;
      }
      if (
        rotationResumeFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          rotationResumeFrameRef.current,
        );
        rotationResumeFrameRef.current =
          null;
      }

      resizeObserver.disconnect();
      for (
        const view of
        mapMarkerViewsRef.current
          .values()
      ) {
        view.cleanup();
        view.marker.remove();
      }
      mapMarkerViewsRef.current
        .clear();
      map.off('load', handleReady);
      map.off('click', handleMapClick);
      map.off('moveend', handleMoveEnd);
      map.remove();
      mapReadyRef.current = false;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    setSelectedMarkerId(null);
    setEditorFeedback(null);
  }, [activeCaseId]);

  useEffect(() => {
    if (
      !coordinatePanelOpen ||
      modulePanelOpen
    ) {
      return undefined;
    }

    function handleEscape(
      event: KeyboardEvent,
    ): void {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setCoordinatePanelOpen(false);
    }

    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [
    coordinatePanelOpen,
    modulePanelOpen,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReadyRef.current ||
      !mapReady
    ) {
      return;
    }

    const visibleIds =
      new Set<string>();

    for (
      const markerData of
      visibleMarkers
    ) {
      visibleIds.add(markerData.id);
      let view =
        mapMarkerViewsRef.current
          .get(markerData.id);

      if (!view) {
        view = createMapMarkerView(
          markerData,
          markerActionsRef,
        );
        view.marker
          .setLngLat([
            markerData.longitude,
            markerData.latitude,
          ])
          .addTo(map);
        mapMarkerViewsRef.current
          .set(
            markerData.id,
            view,
          );
      }

      updateMapMarkerView(
        view,
        markerData,
        copiedTarget ===
          `marker:${markerData.id}`,
      );
    }

    for (
      const [
        markerId,
        view,
      ] of mapMarkerViewsRef.current
    ) {
      if (visibleIds.has(markerId)) {
        continue;
      }

      view.cleanup();
      view.marker.remove();
      mapMarkerViewsRef.current
        .delete(markerId);
    }
  }, [
    copiedTarget,
    mapReady,
    visibleMarkers,
  ]);

  useEffect(() => {
    rotationEnabledRef.current =
      rotationEnabled;

    const map = mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    if (rotationEnabled) {
      startAutoRotation();
      return;
    }

    map.stop();
  }, [
    mapReady,
    rotationEnabled,
    startAutoRotation,
  ]);

  useEffect(() => {
    if (!mapReady) {
      return undefined;
    }

    const updateFrame =
      window.requestAnimationFrame(
        updateViewportPadding,
      );

    return () => {
      window.cancelAnimationFrame(
        updateFrame,
      );
    };
  }, [
    mapReady,
    updateViewportPadding,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReadyRef.current
    ) {
      return;
    }

    map.setPaintProperty(
      'background',
      'background-color',
      monochromeMode
        ? '#000000'
        : '#030303',
    );
    map.setPaintProperty(
      'countries-fill',
      'fill-color',
      monochromeMode
        ? '#0f0f0f'
        : [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          '#101112',
          5,
          '#141516',
        ],
    );
    map.setPaintProperty(
      'countries-border',
      'line-color',
      monochromeMode
        ? 'rgba(255,255,255,0.24)'
        : 'rgba(255,255,255,0.16)',
    );
    map.setPaintProperty(
      'admin1-border',
      'line-color',
      monochromeMode
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(255,255,255,0.08)',
    );
    map.setPaintProperty(
      'city-points',
      'circle-color',
      monochromeMode
        ? 'rgba(255,255,255,0.82)'
        : 'rgba(255,255,255,0.72)',
    );
    map.setPaintProperty(
      'map-labels',
      'text-color',
      monochromeMode
        ? [
          'match',
          ['get', 'kind'],
          'country',
          'rgba(255,255,255,0.82)',
          'admin1',
          'rgba(255,255,255,0.62)',
          'rgba(255,255,255,0.74)',
        ]
        : [
          'match',
          ['get', 'kind'],
          'country',
          'rgba(255,255,255,0.72)',
          'admin1',
          'rgba(255,255,255,0.52)',
          'rgba(255,255,255,0.62)',
        ],
    );
    map.setPaintProperty(
      'map-labels',
      'text-halo-color',
      monochromeMode
        ? 'rgba(0,0,0,0.94)'
        : 'rgba(0,0,0,0.82)',
    );
  }, [monochromeMode]);

  useEffect(() => {
    recenterMap();
  }, [
    recenterMap,
    resetSignal,
  ]);

  return (
    <div
      className={`worldGlobeMap ${
        monochromeMode
          ? 'isMonochrome'
          : ''
      }`}
    >
      <div
        className="worldGlobeMapCanvas"
        ref={containerRef}
      />

      {!mapReady && (
        <div className="worldMapEmptyState">
          Inicializando globo local...
        </div>
      )}

      {markerCount === 0 &&
        visibleMarkers.length === 0 &&
        mapReady && (
          <div className="worldMapEmptyState">
            Nenhuma coordenada cadastrada nos cases.
          </div>
        )}

      <div className="worldGlobeTools">
        <WorkspaceMapMarkerPanel
            activeCaseName={
              activeCase?.name ?? null
            }
            caseBusy={
              caseLoading ||
              caseMutating
            }
            coordinateInput={
              coordinateInput
            }
            copiedTarget={copiedTarget}
            editorFeedback={
              editorFeedback
            }
            locatorFeedback={
              locatorFeedback
            }
            panelOpen={
              coordinatePanelOpen
            }
            recentLocations={
              recentLocations
            }
            savingMarker={savingMarker}
            selectedMarker={
              selectedMarker
            }
            onCenterMarker={(marker) => {
              centerCoordinates(
                marker.latitude,
                marker.longitude,
              );
            }}
            onCenterRecent={(location) => {
              centerCoordinates(
                location.latitude,
                location.longitude,
              );
            }}
            onClearInput={() => {
              setCoordinateInput('');
              setLocatorFeedback(null);
            }}
            onCoordinateInputChange={(
              value,
            ) => {
              setCoordinateInput(value);
              setLocatorFeedback(null);
            }}
            onCopyInput={
              copyCoordinateInput
            }
            onCopyMarker={(marker) => {
              copyCoordinates(
                marker.latitude,
                marker.longitude,
                `marker:${marker.id}`,
              );
            }}
            onCopyRecent={(location) => {
              copyCoordinates(
                location.latitude,
                location.longitude,
                `recent:${location.id}`,
              );
            }}
            onLocate={locateCoordinate}
            onRemoveMarker={
              removeTransientMarker
            }
            onReuseRecent={
              reuseRecentLocation
            }
            onSaveMarker={() => {
              void saveSelectedMarker();
            }}
            onUpdateMarker={
              updateTransientMarker
            }
        />

        <div
          className="worldGlobeControls"
          aria-label="Controles do mapa"
        >
          <button
            type="button"
            aria-label="Aproximar mapa"
            onClick={() => {
              mapRef.current?.zoomIn({
                duration:
                  reducedMotionRef.current
                    ? 0
                    : 220,
              });
            }}
          >
            +
          </button>

          <button
            type="button"
            aria-label="Afastar mapa"
            onClick={() => {
              mapRef.current?.zoomOut({
                duration:
                  reducedMotionRef.current
                    ? 0
                    : 220,
              });
            }}
          >
            −
          </button>

          <button
            type="button"
            aria-label="Recentralizar globo"
            onClick={recenterMap}
          >
            ⊙
          </button>

          <button
            type="button"
            aria-label={
              rotationEnabled
                ? 'Pausar rotação automática'
                : 'Iniciar rotação automática'
            }
            aria-pressed={rotationEnabled}
            onClick={() => {
              setRotationEnabled(
                (current) =>
                  !current,
              );
            }}
          >
            {rotationEnabled
              ? 'Ⅱ'
              : '▶'}
          </button>

          <button
            type="button"
            aria-label={
              monochromeMode
                ? 'Desativar preto e branco'
                : 'Ativar preto e branco'
            }
            aria-pressed={monochromeMode}
            onClick={() => {
              setMonochromeMode(
                (enabled) =>
                  !enabled,
              );
            }}
          >
            P/B
          </button>

          <button
            className="coordinatePanelToggle"
            type="button"
            aria-controls="workspace-coordinate-panel"
            aria-expanded={
              coordinatePanelOpen
            }
            aria-label={
              coordinatePanelOpen
                ? 'Ocultar painel de coordenadas'
                : 'Mostrar painel de coordenadas'
            }
            title={
              coordinatePanelOpen
                ? 'Ocultar painel de coordenadas'
                : 'Mostrar painel de coordenadas'
            }
            onClick={() => {
              setCoordinatePanelOpen(
                (open) => !open,
              );
            }}
          >
            <span aria-hidden="true">
              □
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
