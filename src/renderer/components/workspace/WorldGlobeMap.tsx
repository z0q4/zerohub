import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
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
  WorkspaceMapMarkerPanel,
  formatCoordinates,
  parseCoordinateInput,
} from './WorkspaceMapMarkerPanel';
import {
  MapLayerManager,
} from './MapLayerManager';
import {
  MapOperationalHud,
} from './MapOperationalHud';
import {
  MapMarkerDetailsPopover,
} from './MapMarkerDetailsPopover';
import {
  GeographicTimelineMapLayer,
} from './GeographicTimelineMapLayer';
import {
  GeographicTimelinePanel,
} from './GeographicTimelinePanel';
import {
  GEOGRAPHIC_TIMELINE_EVENT_LABELS,
  buildPersistentMapMarkersFromEvents,
  createMapMarkerRemovedActivity,
  createMapMarkerSavedActivity,
  createMapMarkerUpdatedActivity,
  normalizeMapMarkerDetails,
} from './map-marker-activities';
import {
  getMapMarkerColorValue,
} from './map-workspace.types';
import {
  useMapMarkerLayers,
} from './useMapMarkerLayers';
import {
  useGeographicTimelinePlayback,
} from './useGeographicTimelinePlayback';

import type {
  GeographicMarker,
  MapMarkerDetailsUpdate,
  MapMarkerFeedback,
  MapMarkerSource,
  MapWorkspaceViewState,
  RecentMapLocation,
} from './map-workspace.types';

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
  WorkspaceMode,
} from '../../../shared/modules/module.types';
import type {
  GeographicTimelineEvent,
} from './map-marker-activities';

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
  activeMode: WorkspaceMode;
  focusGeographicActivityId:
    string | null;
  geographicTimelineEvents:
    GeographicTimelineEvent[];
  mapWorkspaceView:
    MapWorkspaceViewState;
  markerCount: number;
  modulePanelOpen: boolean;
  resetSignal: number;

  onMapWorkspaceViewChange(
    viewState: SetStateAction<
      MapWorkspaceViewState
    >,
  ): void;

  onFocusGeographicActivityHandled(): void;

  onOpenCaseActivity(
    activityId: string,
  ): void;
};

type MarkerActionHandlers = {
  select(markerId: string): void;
};

type MapMarkerView = {
  marker: maplibregl.Marker;
  element: HTMLDivElement;
  name: HTMLElement;
  metadata: HTMLElement;
  coordinates: HTMLElement;
  status: HTMLElement;
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

  element.className =
    'coordinateLocationMarker';
  element.tabIndex = 0;
  element.setAttribute('role', 'button');
  element.setAttribute(
    'aria-haspopup',
    'dialog',
  );
  pulse.className =
    'coordinateLocationMarkerPulse';
  glow.className =
    'coordinateLocationMarkerGlow';
  core.className =
    'coordinateLocationMarkerCore';
  tooltip.className =
    'coordinateLocationMarkerTooltip';
  tooltip.append(
    name,
    metadata,
    coordinates,
    status,
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
  element.addEventListener(
    'click',
    handleSelect,
  );
  element.addEventListener(
    'keydown',
    handleKeyDown,
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
    cleanup: () => {
      element.removeEventListener(
        'click',
        handleSelect,
      );
      element.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    },
  };
}

function updateMapMarkerView(
  view: MapMarkerView,
  marker: GeographicMarker,
  expanded: boolean,
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
    getMapMarkerColorValue(
      marker.color,
    ),
  );
  view.element.setAttribute(
    'aria-label',
    `${displayName}, ${marker.category}, ${coordinateText}`,
  );
  view.element.setAttribute(
    'aria-expanded',
    String(expanded),
  );
  view.element.classList.toggle(
    'isSelected',
    expanded,
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
  activeMode,
  focusGeographicActivityId,
  geographicTimelineEvents,
  mapWorkspaceView,
  markerCount,
  modulePanelOpen,
  onFocusGeographicActivityHandled,
  onMapWorkspaceViewChange,
  onOpenCaseActivity,
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
  const timelineCameraMovingRef =
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
    popoverMarkerId,
    setPopoverMarkerId,
  ] = useState<string | null>(null);
  const [
    copiedTarget,
    setCopiedTarget,
  ] = useState<string | null>(null);
  const [
    savingMarker,
    setSavingMarker,
  ] = useState(false);
  const [
    timelineCameraMoving,
    setTimelineCameraMoving,
  ] = useState(false);

  const activeCaseId =
    activeCase?.id ?? null;
  const geographicTimeline =
    useGeographicTimelinePlayback({
      caseId: activeCaseId,
      events:
        geographicTimelineEvents,
      focusActivityId:
        focusGeographicActivityId,
      onFocusActivityHandled:
        onFocusGeographicActivityHandled,
    });
  const persistentMarkers =
    useMemo(() => {
      return buildPersistentMapMarkersFromEvents(
        geographicTimeline.events,
      );
    }, [geographicTimeline.events]);
  const profileMarkers =
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
  const {
    changeColorFilter,
    closeLayerManager,
    hideAllLayers,
    setOperationalHudOpen,
    showAllLayers,
    toggleCategory,
    toggleLayerManager,
    visibleMarkers,
  } = useMapMarkerLayers(
    profileMarkers,
    mapWorkspaceView,
    onMapWorkspaceViewChange,
  );
  const selectedMarker =
    useMemo(
      () =>
        profileMarkers.find(
          (marker) =>
            marker.id ===
            selectedMarkerId,
        ) ?? null,
      [
        selectedMarkerId,
        profileMarkers,
      ],
    );
  const popoverMarker =
    useMemo(
      () =>
        visibleMarkers.find(
          (marker) =>
            marker.id ===
            popoverMarkerId,
        ) ?? null,
      [
        popoverMarkerId,
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
        timelineCameraMovingRef.current ||
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

  const handleTimelineCameraMotionChange =
    useCallback(
      (moving: boolean): void => {
        timelineCameraMovingRef.current =
          moving;
        setTimelineCameraMoving(
          (current) =>
            current === moving
              ? current
              : moving,
        );

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

        if (
          !moving &&
          rotationEnabledRef.current
        ) {
          rotationResumeFrameRef.current =
            window.requestAnimationFrame(
              () => {
                rotationResumeFrameRef.current =
                  null;
                startAutoRotationRef.current();
              },
            );
        }
      },
      [],
    );

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
          activityId: null,
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

        if (update.name !== undefined) {
          setTransientRecentLocations(
            (current) =>
              current.map(
                (location) =>
                  location.id ===
                  `recent-${markerId}`
                    ? {
                        ...location,
                        name:
                          update.name ??
                          location.name,
                      }
                    : location,
              ),
          );
        }

        setEditorFeedback(null);
      },
      [],
    );

  const updateMarkerDetails =
    useCallback(
      async (
        marker: GeographicMarker,
        update: MapMarkerDetailsUpdate,
      ): Promise<void> => {
        const normalized =
          normalizeMapMarkerDetails(
            marker,
            update,
          );

        if (!marker.saved) {
          updateTransientMarker(
            marker.id,
            {
              category:
                normalized.category,
              color: normalized.color,
              name: normalized.name,
            },
          );
          return;
        }

        if (
          !activeCase ||
          marker.caseId !== activeCase.id
        ) {
          throw new Error(
            'O perfil relacionado ao marcador não está ativo.',
          );
        }

        await addActivity(
          createMapMarkerUpdatedActivity(
            activeCase.id,
            marker,
            normalized,
          ),
        );

        setEditorFeedback({
          message:
            `Marcador atualizado em ${activeCase.name}.`,
          tone: 'success',
        });
      },
      [
        activeCase,
        addActivity,
        updateTransientMarker,
      ],
    );

  const removeMarker =
    useCallback(
      async (
        marker: GeographicMarker,
      ): Promise<void> => {
        if (!marker.saved) {
          removeTransientMarker(
            marker.id,
          );
          setPopoverMarkerId(null);
          return;
        }

        if (
          !activeCase ||
          marker.caseId !== activeCase.id
        ) {
          throw new Error(
            'O perfil relacionado ao marcador não está ativo.',
          );
        }

        await addActivity(
          createMapMarkerRemovedActivity(
            activeCase.id,
            marker,
          ),
        );

        setPopoverMarkerId(null);
        setSelectedMarkerId(
          (current) =>
            current === marker.id
              ? null
              : current,
        );
        setEditorFeedback({
          message:
            `Remoção registrada em ${activeCase.name}.`,
          tone: 'success',
        });
      },
      [
        activeCase,
        addActivity,
        removeTransientMarker,
      ],
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
      let activityInput:
        ReturnType<
          typeof createMapMarkerSavedActivity
        >;

      try {
        activityInput =
          createMapMarkerSavedActivity(
            targetCase.id,
            selectedMarker,
          );
      } catch (unknownError) {
        setEditorFeedback({
          message:
            unknownError instanceof Error
              ? unknownError.message
              : 'Não foi possível validar o marcador.',
          tone: 'error',
        });
        return;
      }

      savingMarkerRef.current = true;
      setSavingMarker(true);
      setEditorFeedback(null);

      try {
        await addActivity(
          activityInput,
        );

        setTransientMarkers(
          (current) =>
            current.filter(
              (marker) =>
                marker.id !==
                selectedMarker.id,
            ),
        );
        setTransientRecentLocations(
          (current) =>
            current.filter(
              (location) =>
                location.id !==
                `recent-${selectedMarker.id}`,
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

  startAutoRotationRef.current =
    startAutoRotation;
  updateViewportPaddingRef.current =
    updateViewportPadding;
  captureCoordinateRef.current =
    captureCoordinate;
  markerActionsRef.current = {
    select: (markerId) => {
      setSelectedMarkerId(markerId);
      setPopoverMarkerId(markerId);
    },
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
    setPopoverMarkerId(null);
    setEditorFeedback(null);
  }, [activeCaseId]);

  useEffect(() => {
    if (
      popoverMarkerId &&
      !popoverMarker
    ) {
      setPopoverMarkerId(null);
    }
  }, [
    popoverMarker,
    popoverMarkerId,
  ]);

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
        popoverMarkerId ===
          markerData.id,
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
    mapReady,
    popoverMarkerId,
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

  const popoverMarkerView =
    popoverMarker
      ? mapMarkerViewsRef.current
        .get(popoverMarker.id) ?? null
      : null;
  const timelineHudPlayback =
    useMemo(() => {
      if (
        !geographicTimeline.panelOpen ||
        !geographicTimeline.currentEvent ||
        geographicTimeline.events.length ===
          0
      ) {
        return null;
      }

      return {
        currentEvent:
          geographicTimeline.currentIndex +
          1,
        eventType:
          GEOGRAPHIC_TIMELINE_EVENT_LABELS[
            geographicTimeline
              .currentEvent.type
          ],
        isPlaying:
          geographicTimeline.isPlaying,
        speed:
          geographicTimeline.speed,
        totalEvents:
          geographicTimeline.events.length,
      };
    }, [
      geographicTimeline.currentEvent,
      geographicTimeline.currentIndex,
      geographicTimeline.events.length,
      geographicTimeline.isPlaying,
      geographicTimeline.panelOpen,
      geographicTimeline.speed,
    ]);

  const centerPopoverMarker =
    useCallback(
      (
        marker: GeographicMarker,
      ): void => {
        centerCoordinates(
          marker.latitude,
          marker.longitude,
        );
      },
      [centerCoordinates],
    );

  const closeMarkerPopover =
    useCallback((): void => {
      setPopoverMarkerId(null);
    }, []);

  const copyPopoverMarker =
    useCallback(
      (
        marker: GeographicMarker,
      ): void => {
        copyCoordinates(
          marker.latitude,
          marker.longitude,
          `marker:${marker.id}`,
        );
      },
      [copyCoordinates],
    );

  const openPopoverMarkerTimeline =
    useCallback(
      (activityId: string): void => {
        setPopoverMarkerId(null);
        onOpenCaseActivity(
          activityId,
        );
      },
      [onOpenCaseActivity],
    );

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

      <GeographicTimelineMapLayer
        event={
          geographicTimeline.activeEvent
        }
        map={
          mapReady
            ? mapRef.current
            : null
        }
        selectionRevision={
          geographicTimeline
            .selectionRevision
        }
        onCameraMotionChange={
          handleTimelineCameraMotionChange
        }
      />

      {!mapReady && (
        <div className="worldMapEmptyState">
          Inicializando globo local...
        </div>
      )}

      {markerCount === 0 &&
        profileMarkers.length === 0 &&
        mapReady && (
          <div className="worldMapEmptyState">
            Nenhuma coordenada cadastrada nos cases.
          </div>
        )}

      <MapOperationalHud
        activeCaseName={
          activeCase?.name ?? null
        }
        map={
          mapReady
            ? mapRef.current
            : null
        }
        mode={activeMode}
        open={
          mapWorkspaceView
            .operationalHudOpen
        }
        rotationEnabled={
          rotationEnabled
        }
        rotationTemporarilyPaused={
          rotationEnabled &&
          timelineCameraMoving
        }
        timelinePlayback={
          timelineHudPlayback
        }
        totalMarkers={
          profileMarkers.length
        }
        visibleMarkers={
          visibleMarkers.length
        }
        onOpenChange={
          setOperationalHudOpen
        }
      />

      <GeographicTimelinePanel
        currentEvent={
          geographicTimeline.currentEvent
        }
        currentIndex={
          geographicTimeline.currentIndex
        }
        isPlaying={
          geographicTimeline.isPlaying
        }
        open={
          geographicTimeline.panelOpen
        }
        speed={
          geographicTimeline.speed
        }
        totalEvents={
          geographicTimeline.events.length
        }
        onMinimize={
          geographicTimeline.minimizePanel
        }
        onNext={
          geographicTimeline.next
        }
        onOpen={
          geographicTimeline.openPanel
        }
        onPause={
          geographicTimeline.pause
        }
        onPlay={
          geographicTimeline.play
        }
        onPrevious={
          geographicTimeline.previous
        }
        onRestart={
          geographicTimeline.restart
        }
        onSeek={
          geographicTimeline.seek
        }
        onSpeedChange={
          geographicTimeline.setSpeed
        }
      />

      {mapReady &&
        popoverMarker &&
        popoverMarkerView &&
        mapRef.current &&
        containerRef.current && (
          <MapMarkerDetailsPopover
            key={popoverMarker.id}
            anchorElement={
              popoverMarkerView.element
            }
            caseBusy={
              caseLoading ||
              caseMutating
            }
            caseName={
              popoverMarker.caseId ===
                activeCase?.id
                ? activeCase.name
                : null
            }
            copied={
              copiedTarget ===
              `marker:${popoverMarker.id}`
            }
            map={mapRef.current}
            marker={popoverMarker}
            viewportElement={
              containerRef.current
            }
            onCenter={
              centerPopoverMarker
            }
            onClose={
              closeMarkerPopover
            }
            onCopy={
              copyPopoverMarker
            }
            onOpenTimeline={
              openPopoverMarkerTimeline
            }
            onRemove={removeMarker}
            onUpdate={
              updateMarkerDetails
            }
          />
        )}

      <div className="worldGlobeTools">
        <div className="worldGlobePanels">
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

          <MapLayerManager
            colorFilter={
              mapWorkspaceView
                .markerColorFilter
            }
            hiddenCategories={
              mapWorkspaceView
                .hiddenMarkerCategories
            }
            markers={profileMarkers}
            open={
              mapWorkspaceView
                .layerManagerOpen
            }
            onClose={
              closeLayerManager
            }
            onColorFilterChange={
              changeColorFilter
            }
            onHideAll={
              hideAllLayers
            }
            onShowAll={
              showAllLayers
            }
            onToggleCategory={
              toggleCategory
            }
          />
        </div>

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
            className={
              rotationEnabled &&
              timelineCameraMoving
                ? 'isTimelinePaused'
                : undefined
            }
            type="button"
            aria-label={
              rotationEnabled &&
              timelineCameraMoving
                ? 'Desativar rotação automática pausada pela Timeline Geográfica'
                : rotationEnabled
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
            {rotationEnabled &&
            timelineCameraMoving
              ? '…'
              : rotationEnabled
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
            className="layerManagerToggle"
            type="button"
            aria-controls="map-layer-manager"
            aria-expanded={
              mapWorkspaceView
                .layerManagerOpen
            }
            aria-label={
              mapWorkspaceView
                .layerManagerOpen
                ? 'Ocultar gerenciador de camadas'
                : 'Mostrar gerenciador de camadas'
            }
            title="Gerenciador de camadas"
            onClick={toggleLayerManager}
          >
            <span aria-hidden="true">
              ◫
            </span>
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
