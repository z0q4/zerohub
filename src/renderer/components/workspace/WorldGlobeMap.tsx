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
  type LayerSpecification,
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
import { HierarchicalLocationPanel } from './HierarchicalLocationPanel';
import { WorkspaceIcon } from './WorkspaceIcon';
import { MapContextInspector } from './MapContextInspector';
import { MapLayerPresentation } from './MapLayerPresentation';
import { SignalLab } from './signal-lab/SignalLab';
import type { VisualLayerId, VisualLayerSettings } from './map-layer-presentation';
import { useIbgeMunicipality } from './useIbgeMunicipality';
import { useRecifeGeometry } from './useRecifeGeometry';
import { restoredLocationCamera, restoreSavedLocation } from './location-restoration';
import { LocationSelectionMapLayer } from './LocationSelectionMapLayer';
import { geometryBounds, ibgeStateForSelection, resolveLocalBoundary } from './location-boundaries';
import { LOCATION_LEVELS, selectLocationLevel, selectionFeatures } from './location-selection';
import type { LocationLevel, LocationSelection } from './location-selection';
import type {
  MapOperationalLayerSummary,
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
  IpGeolocationMapLayer,
} from './IpGeolocationMapLayer';
import {
  IpGeolocationPanel,
} from './IpGeolocationPanel';
import {
  GeographicSearchMapLayer,
} from './GeographicSearchMapLayer';
import {
  GeographicSearchResultPanel,
} from './GeographicSearchResultPanel';
import {
  MapMeasurementTools,
} from './MapMeasurementTools';
import {
  MapGeoJsonTools,
} from './MapGeoJsonTools';
import {
  MapComparisonPanel,
} from './MapComparisonPanel';
import type {
  GeographicComparisonItem,
} from './MapComparisonPanel';
import {
  GEOGRAPHIC_TIMELINE_EVENT_LABELS,
  buildPersistentIpResultsFromEvents,
  buildPersistentMapMarkersFromEvents,
} from './geographic-timeline-activities';
import {
  formatIpGeolocationSummary,
} from './ip-geolocation-activities';
import {
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
import {
  useIpGeolocationIntelligence,
} from './useIpGeolocationIntelligence';

import type {
  DetailedBasemapStatus,
  GeographicMarker,
  MapBasemapStyle,
  MapCameraState,
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
} from './geographic-timeline-activities';
import type {
  IpGeolocationResult,
} from './ip-geolocation.types';
import type {
  GeographicBoundingBox,
  GeographicSearchResult,
} from '../../../shared/geographic-search/geographic-search.types';
import type {
  UniversalMapCommand,
} from './universal-search.types';

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
  onBasemapStatusChange(status: DetailedBasemapStatus): void;
  onMapInstanceChange(map: MapLibreMap | null): void;
  providerVisible: boolean;
  cleanMapMode: boolean;
  focusGeographicActivityId:
    string | null;
  geographicTimelineEvents:
    GeographicTimelineEvent[];
  geographicSearchBusy: boolean;
  geographicSearchResult:
    GeographicSearchResult | null;
  geographicSearchResultFavorite:
    boolean;
  mapWorkspaceView:
    MapWorkspaceViewState;
  markerCount: number;
  modulePanelOpen: boolean;
  resetSignal: number;
  universalMapCommand:
    UniversalMapCommand | null;

  onMapWorkspaceViewChange(
    viewState: SetStateAction<
      MapWorkspaceViewState
    >,
  ): void;

  onFocusGeographicActivityHandled(): void;

  onOpenCaseActivity(
    activityId: string,
  ): void;

  onOpenIpRdap(ip: string): void;

  onMapViewportChange(
    viewport:
      GeographicBoundingBox | null,
  ): void;

  onClearGeographicSearch(): void;

  onReverseGeographicSearch(
    latitude: number,
    longitude: number,
  ): Promise<void>;

  onToggleGeographicFavorite(): void;
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

type DetailedBasemapProvider = {
  id: 'openfreemap';
  attribution: string;
  sourceUrl: string;
};

const INITIAL_CENTER: [number, number] = [
  -20,
  0,
];
const EMPTY_LOCATION_SELECTION: LocationSelection = {};
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
const MIN_MARKER_VISUAL_SCALE = 0.58;
const MAX_MARKER_VISUAL_SCALE = 1.28;
const DETAILED_BASEMAP_MIN_ZOOM = 5;
const DETAILED_BASEMAP_PROVIDER:
  DetailedBasemapProvider = {
    id: 'openfreemap',
    attribution:
      'OpenFreeMap © OpenMapTiles · Dados © OpenStreetMap contributors',
    sourceUrl:
      'https://tiles.openfreemap.org/planet',
  };

function normalizeCameraLongitude(
  longitude: number,
): number {
  return (
    (
      (longitude + 180) % 360 +
      360
    ) % 360
  ) - 180;
}

function readMapCamera(
  map: MapLibreMap,
): MapCameraState {
  const center = map.getCenter();

  return {
    bearing: map.getBearing(),
    latitude: center.lat,
    longitude:
      normalizeCameraLongitude(
        center.lng,
      ),
    pitch: map.getPitch(),
    zoom: map.getZoom(),
  };
}

function camerasApproximatelyEqual(
  left: MapCameraState,
  right: MapCameraState,
): boolean {
  return (
    Math.abs(
      left.longitude - right.longitude,
    ) < 0.000001 &&
    Math.abs(
      left.latitude - right.latitude,
    ) < 0.000001 &&
    Math.abs(left.zoom - right.zoom) <
      0.000001 &&
    Math.abs(
      left.bearing - right.bearing,
    ) < 0.000001 &&
    Math.abs(left.pitch - right.pitch) <
      0.000001
  );
}
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

function updateMarkerVisualScale(
  map: MapLibreMap,
): void {
  const scale = Math.min(
    MAX_MARKER_VISUAL_SCALE,
    Math.max(
      MIN_MARKER_VISUAL_SCALE,
      0.56 + map.getZoom() * 0.075,
    ),
  );

  map.getContainer().style.setProperty(
    '--coordinate-marker-scale',
    scale.toFixed(3),
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

function isDetailedBasemapLayer(
  layer: LayerSpecification,
): boolean {
  return (
    'source' in layer &&
    layer.source === 'detailed-basemap'
  );
}

function createMapStyle(
  includeDetailedBasemap = false,
):
  StyleSpecification {
  const style: StyleSpecification = {
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
      'detailed-basemap': {
        type: 'vector',
        url:
          DETAILED_BASEMAP_PROVIDER
            .sourceUrl,
        attribution:
          DETAILED_BASEMAP_PROVIDER
            .attribution,
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
        id: 'detailed-water',
        type: 'fill',
        source: 'detailed-basemap',
        'source-layer': 'water',
        minzoom: 5,
        paint: {
          'fill-color': '#08161d',
          'fill-opacity': 0.95,
        },
      },
      {
        id: 'detailed-landuse',
        type: 'fill',
        source: 'detailed-basemap',
        'source-layer': 'landuse',
        minzoom: 7,
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'residential',
            '#17191a',
            'commercial',
            '#1b1819',
            'industrial',
            '#1b1a16',
            '#131515',
          ],
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'detailed-buildings',
        type: 'fill',
        source: 'detailed-basemap',
        'source-layer': 'building',
        minzoom: 12,
        paint: {
          'fill-color': '#242728',
          'fill-outline-color':
            'rgba(255,255,255,0.12)',
          'fill-opacity': 0.9,
        },
      },
      {
        id: 'detailed-roads-casing',
        type: 'line',
        source: 'detailed-basemap',
        'source-layer': 'transportation',
        minzoom: 6,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#080909',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            ['match', ['get', 'class'], 'motorway', 1.2, 'trunk', 1, 'primary', 0.85, 0.35],
            12,
            ['match', ['get', 'class'], 'motorway', 4.2, 'trunk', 3.8, 'primary', 3.3, 'secondary', 2.7, 1.5],
            18,
            ['match', ['get', 'class'], 'motorway', 15, 'trunk', 13, 'primary', 11, 'secondary', 9, 6],
          ],
          'line-opacity': 0.8,
        },
      },
      {
        id: 'detailed-roads',
        type: 'line',
        source: 'detailed-basemap',
        'source-layer': 'transportation',
        minzoom: 6,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            'motorway',
            '#85715a',
            'trunk',
            '#726752',
            'primary',
            '#5c5a50',
            '#3a3d3e',
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            ['match', ['get', 'class'], 'motorway', 0.7, 'trunk', 0.6, 'primary', 0.5, 0.2],
            12,
            ['match', ['get', 'class'], 'motorway', 2.8, 'trunk', 2.5, 'primary', 2.1, 'secondary', 1.6, 0.8],
            18,
            ['match', ['get', 'class'], 'motorway', 11, 'trunk', 9.5, 'primary', 8, 'secondary', 6.5, 4],
          ],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'class'], 'motorway', 0.9, 'trunk', 0.85, 'primary', 0.75, 0.22], 12, 0.9],
        },
      },
      {
        id: 'detailed-place-labels',
        type: 'symbol',
        source: 'detailed-basemap',
        'source-layer': 'place',
        minzoom: 5,
        layout: {
          'text-field': [
            'coalesce',
            ['get', 'name:pt'],
            ['get', 'name'],
          ],
          'text-font': [
            'Inter',
            'Segoe UI',
            'Arial',
            'sans-serif',
          ],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            8,
            14,
            12,
          ],
          'text-max-width': 12,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color':
            'rgba(235,235,235,0.8)',
          'text-halo-color':
            'rgba(0,0,0,0.9)',
          'text-halo-width': 1,
        },
      },
      {
        id: 'detailed-road-labels',
        type: 'symbol',
        source: 'detailed-basemap',
        'source-layer':
          'transportation_name',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'text-field': [
            'coalesce',
            ['get', 'name:pt'],
            ['get', 'name'],
          ],
          'text-font': [
            'Inter',
            'Segoe UI',
            'Arial',
            'sans-serif',
          ],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            8,
            18,
            11,
          ],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color':
            'rgba(220,220,220,0.72)',
          'text-halo-color':
            'rgba(0,0,0,0.92)',
          'text-halo-width': 1,
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

  if (!includeDetailedBasemap) {
    delete style.sources[
      'detailed-basemap'
    ];
    style.layers = style.layers.filter(
      (layer) =>
        !isDetailedBasemapLayer(layer),
    );
  }

  return style;
}

function addDetailedBasemap(
  map: MapLibreMap,
): void {
  if (
    map.getSource('detailed-basemap')
  ) {
    return;
  }

  const detailedStyle =
    createMapStyle(true);
  const source =
    detailedStyle.sources[
      'detailed-basemap'
    ];

  map.addSource(
    'detailed-basemap',
    source,
  );

  for (const layer of detailedStyle.layers) {
    if (isDetailedBasemapLayer(layer)) {
      map.addLayer(layer, 'map-labels');
    }
  }
}

function removeDetailedBasemap(
  map: MapLibreMap,
): void {
  const detailedLayers =
    createMapStyle(true).layers
      .filter(isDetailedBasemapLayer)
      .reverse();

  for (const layer of detailedLayers) {
    if (map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  }

  if (map.getSource('detailed-basemap')) {
    map.removeSource('detailed-basemap');
  }
}

function applyDetailedBasemapColors(
  map: MapLibreMap,
  basemapStyle: MapBasemapStyle,
): void {
  if (!map.getLayer('detailed-water')) {
    return;
  }

  map.setPaintProperty(
    'detailed-water',
    'fill-color',
    basemapStyle === 'tactical'
      ? '#0b171b'
      : basemapStyle === 'streets-light'
      ? '#cfe5ee'
      : '#08161d',
  );
  map.setPaintProperty(
    'detailed-landuse',
    'fill-color',
    basemapStyle === 'tactical'
      ? '#151515'
      : basemapStyle === 'streets-light'
      ? [
        'match',
        ['get', 'class'],
        'residential',
        '#ebe8df',
        'commercial',
        '#eee1df',
        'industrial',
        '#e5e1d5',
        'park',
        '#dce9d3',
        '#e8e6df',
      ]
      : [
        'match',
        ['get', 'class'],
        'residential',
        '#17191a',
        'commercial',
        '#1b1819',
        'industrial',
        '#1b1a16',
        '#131515',
      ],
  );
  map.setPaintProperty(
    'detailed-buildings',
    'fill-color',
    basemapStyle === 'tactical'
      ? '#202020'
      : basemapStyle === 'streets-light'
      ? '#d8d5ce'
      : '#242728',
  );
  map.setPaintProperty(
    'detailed-buildings',
    'fill-outline-color',
    basemapStyle === 'streets-light' ? 'rgba(104,111,110,0.22)' : 'rgba(205,220,220,0.12)',
  );
  map.setPaintProperty(
    'detailed-roads',
    'line-color',
    basemapStyle === 'tactical'
      ? ['match', ['get', 'class'], 'motorway', '#788887', 'trunk', '#657675', 'primary', '#586966', 'secondary', '#475552', '#343e3d']
      : basemapStyle === 'streets-light'
      ? [
        'match',
        ['get', 'class'],
        'motorway',
        '#d69b63',
        'trunk',
        '#d6ad75',
        'primary',
        '#d2ba8f',
        '#ffffff',
      ]
      : [
        'match',
        ['get', 'class'],
        'motorway',
        '#85715a',
        'trunk',
        '#726752',
        'primary',
        '#5c5a50',
        '#3a3d3e',
      ],
  );
  map.setPaintProperty(
    'detailed-roads-casing',
    'line-color',
    basemapStyle === 'streets-light'
      ? '#c3beb4'
      : '#080909',
  );
  map.setPaintProperty(
    'detailed-place-labels',
    'text-color',
    basemapStyle === 'streets-light'
      ? 'rgba(36,42,46,0.88)'
      : 'rgba(235,235,235,0.8)',
  );
  map.setPaintProperty(
    'detailed-place-labels',
    'text-halo-color',
    basemapStyle === 'streets-light'
      ? 'rgba(255,255,255,0.9)'
      : 'rgba(0,0,0,0.9)',
  );
  map.setPaintProperty(
    'detailed-road-labels',
    'text-color',
    basemapStyle === 'streets-light'
      ? 'rgba(55,60,62,0.82)'
      : 'rgba(220,220,220,0.72)',
  );
  map.setPaintProperty(
    'detailed-road-labels',
    'text-halo-color',
    basemapStyle === 'streets-light'
      ? 'rgba(255,255,255,0.94)'
      : 'rgba(0,0,0,0.92)',
  );
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
  onBasemapStatusChange,
  onMapInstanceChange,
  providerVisible,
  cleanMapMode,
  focusGeographicActivityId,
  geographicSearchBusy,
  geographicSearchResult,
  geographicSearchResultFavorite,
  geographicTimelineEvents,
  mapWorkspaceView,
  markerCount,
  modulePanelOpen,
  onClearGeographicSearch,
  onFocusGeographicActivityHandled,
  onMapViewportChange,
  onMapWorkspaceViewChange,
  onOpenCaseActivity,
  onOpenIpRdap,
  onReverseGeographicSearch,
  onToggleGeographicFavorite,
  resetSignal,
  universalMapCommand,
}: WorldGlobeMapProps) {
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const [inspectorDetailsOpen, setInspectorDetailsOpen] = useState(true);
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<'location' | 'layers' | 'ip' | 'markers'>('layers');
  const [visualLayerSettings, setVisualLayerSettings] = useState<VisualLayerSettings>({ opacity: { 'location-selection': 1, 'imported-geojson': 1 }, order: ['location-selection', 'imported-geojson'] });
  const [importedGeoJsonBounds, setImportedGeoJsonBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [locationSelection, setLocationSelection] = useState<LocationSelection>({});
  const [locationAutoZoom, setLocationAutoZoom] = useState(true);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [locationRestoreRevision, setLocationRestoreRevision] = useState(0);
  const locationCaseRef = useRef<string | null | undefined>(undefined);
  const pendingLocationCamera = useRef<LocationSelection | null>(null);
  const locationRestoreCameraMoving = useRef(false);
  const locationRestoreCameraCleanup = useRef<(() => void) | null>(null);
  const locationSavingRef = useRef(false);
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
  const basemapStyleRef =
    useRef<MapBasemapStyle>(
      'tactical',
    );
  const persistMapCameraRef =
    useRef<() => void>(
      () => undefined,
    );
  const detailedBasemapRetryRef =
    useRef<() => void>(
      () => undefined,
    );
  const handledUniversalCommandRef =
    useRef<string | null>(null);
  const [
    rotationEnabled,
    setRotationEnabled,
  ] = useState(false);
  const basemapStyle =
    mapWorkspaceView.basemapStyle;
  const monochromeMode =
    basemapStyle === 'tactical';
  const setBasemapStyle =
    useCallback(
      (style: MapBasemapStyle): void => {
        onMapWorkspaceViewChange(
          (current) => ({
            ...current,
            basemapStyle: style,
            monochromeMode:
              style === 'tactical',
          }),
        );
      },
      [onMapWorkspaceViewChange],
    );
  const toggleMonochromeMode =
    useCallback((): void => {
      onMapWorkspaceViewChange(
        (current) => ({
          ...current,
          basemapStyle:
            current.basemapStyle ===
              'tactical'
              ? 'streets-dark'
              : 'tactical',
          monochromeMode:
            current.basemapStyle !==
            'tactical',
        }),
      );
    }, [onMapWorkspaceViewChange]);
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
  const [
    detailedBasemapStatus,
    setDetailedBasemapStatus,
  ] = useState<DetailedBasemapStatus>('local');
  useEffect(() => { onBasemapStatusChange(detailedBasemapStatus); }, [detailedBasemapStatus, onBasemapStatusChange]);
  const [
    measurementPointCount,
    setMeasurementPointCount,
  ] = useState(0);
  const [
    importedGeoJsonCount,
    setImportedGeoJsonCount,
  ] = useState(0);
  const [
    comparisonSelectionCount,
    setComparisonSelectionCount,
  ] = useState(0);

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
  const persistentIpResults =
    useMemo(
      () =>
        buildPersistentIpResultsFromEvents(
          geographicTimeline.events,
        ),
      [geographicTimeline.events],
    );
  const ipIntelligence =
    useIpGeolocationIntelligence({
      activeCaseId,
      addActivity,
      persistentResults:
        persistentIpResults,
    });
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
    toggleIpIntelligence,
    toggleLayerManager,
    toggleOperationalLayer,
    visibleMarkers,
  } = useMapMarkerLayers(
    profileMarkers,
    mapWorkspaceView,
    onMapWorkspaceViewChange,
  );
  const hiddenOperationalLayerSet =
    useMemo(
      () => new Set(
        mapWorkspaceView
          .hiddenOperationalLayers,
      ),
      [
        mapWorkspaceView
          .hiddenOperationalLayers,
      ],
    );
  const selectionGeometryCount = useMemo(() => selectionFeatures(locationSelection).features.length, [locationSelection]);
  const operationalLayers = useMemo(
    (): MapOperationalLayerSummary[] => [
      {
        id: 'geographic-search',
        label: 'Busca geográfica',
        total:
          geographicSearchResult
            ? 1
            : 0,
        detail: 'resultado ativo',
        status: geographicSearchBusy ? { kind: 'loading', message: 'Pesquisando localização…' } : undefined,
      },
      {
        id: 'geographic-timeline',
        label: 'Timeline geográfica',
        total:
          geographicTimeline.events.length,
        detail: 'eventos do case',
      },
      {
        id: 'measurements',
        label: 'Medições',
        total: measurementPointCount,
        detail: 'pontos medidos',
      },
      {
        id: 'imported-geojson',
        label: 'GeoJSON importado',
        total: importedGeoJsonCount,
        detail: 'features transitórias',
      },
      {
        id: 'location-selection',
        label: 'Seleção geográfica',
        total: selectionGeometryCount,
        detail: 'níveis com geometria',
        status: locationFeedback?.startsWith('Consultando') ? { kind: 'loading', message: locationFeedback } : locationFeedback && /indisponível|não encontrado|sem correspondência|incompatível/i.test(locationFeedback) ? { kind: 'error', message: locationFeedback } : undefined,
      },
      {
        id: 'comparison',
        label: 'Comparação',
        total: comparisonSelectionCount,
        detail: 'locais selecionados',
      },
    ],
    [
      comparisonSelectionCount,
      geographicSearchResult,
      geographicSearchBusy,
      geographicTimeline.events.length,
      importedGeoJsonCount,
      selectionGeometryCount,
      locationFeedback,
      measurementPointCount,
    ],
  );
  const zoomableVisualLayers = useMemo<VisualLayerId[]>(() => [
    ...(locationSelection.country ? ['location-selection' as const] : []),
    ...(importedGeoJsonBounds ? ['imported-geojson' as const] : []),
  ], [locationSelection.country, importedGeoJsonBounds]);
  const changeVisualOpacity = useCallback((id: VisualLayerId, opacity: number) => {
    setVisualLayerSettings((current) => ({ ...current, opacity: { ...current.opacity, [id]: Math.max(0, Math.min(1, opacity)) } }));
  }, []);
  const moveVisualLayer = useCallback((id: VisualLayerId, direction: -1 | 1) => {
    setVisualLayerSettings((current) => {
      const order = [...current.order]; const index = order.indexOf(id); const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, order };
    });
  }, []);
  const zoomVisualLayer = useCallback((id: VisualLayerId) => {
    const map = mapRef.current;
    if (!map) return;
    const camera = id === 'location-selection' ? restoredLocationCamera(locationSelection) : importedGeoJsonBounds ? { bounds: importedGeoJsonBounds, maxZoom: 15 } : null;
    if (!camera) return;
    const duration = reducedMotionRef.current ? 0 : 450;
    if ('bounds' in camera) map.fitBounds(camera.bounds, { padding: 40, maxZoom: camera.maxZoom, duration });
    else map.flyTo({ center: camera.center, zoom: camera.zoom, duration, essential: false });
  }, [importedGeoJsonBounds, locationSelection]);
  const visibleIpResults =
    useMemo(() => {
      if (
        !mapWorkspaceView
          .ipIntelligenceVisible
      ) {
        return [];
      }

      if (
        mapWorkspaceView
          .markerColorFilter === 'all'
      ) {
        return ipIntelligence.results;
      }

      return ipIntelligence.results.filter(
        (result) =>
          result.color ===
          mapWorkspaceView
            .markerColorFilter,
      );
    }, [
      ipIntelligence.results,
      mapWorkspaceView
        .ipIntelligenceVisible,
      mapWorkspaceView.markerColorFilter,
    ]);
  const exportableMapData = useMemo(
    (): FeatureCollection<Point> => {
      const features: Feature<Point>[] = [
        ...profileMarkers.map(
          (marker): Feature<Point> => ({
            type: 'Feature',
            properties: {
              id: marker.id,
              name: marker.name,
              kind: 'marker',
              category: marker.category,
              color: marker.color,
              persisted: marker.saved,
              createdAt: marker.createdAt,
            },
            geometry: {
              type: 'Point',
              coordinates: [
                marker.longitude,
                marker.latitude,
              ],
            },
          }),
        ),
        ...ipIntelligence.allResults.map(
          (result): Feature<Point> => ({
            type: 'Feature',
            properties: {
              id: result.id,
              kind: 'ip-geolocation',
              ip: result.ip,
              precision: 'regional-estimate',
              provider: result.provider,
              persisted: result.saved,
            },
            geometry: {
              type: 'Point',
              coordinates: [
                result.longitude,
                result.latitude,
              ],
            },
          }),
        ),
      ];

      if (geographicSearchResult) {
        features.push({
          type: 'Feature',
          properties: {
            id: geographicSearchResult.id,
            kind: 'geographic-search',
            name: geographicSearchResult.name,
            precision: 'approximate',
            provider:
              geographicSearchResult.provider,
          },
          geometry: {
            type: 'Point',
            coordinates: [
              geographicSearchResult.longitude,
              geographicSearchResult.latitude,
            ],
          },
        });
      }

      return {
        type: 'FeatureCollection',
        features,
      };
    }, [
      geographicSearchResult,
      ipIntelligence.allResults,
      profileMarkers,
    ],
  );
  const comparisonItems = useMemo(
    (): GeographicComparisonItem[] => [
      ...profileMarkers.map((marker) => ({
        id: `marker:${marker.id}`,
        coordinate: [
          marker.longitude,
          marker.latitude,
        ] as [number, number],
        label: marker.name,
        origin: marker.saved
          ? 'Marcador persistido'
          : 'Marcador transitório',
        precision:
          'Precisão definida pelo usuário',
        details: marker.category,
      })),
      ...ipIntelligence.allResults.map(
        (result) => ({
          id: `ip:${result.id}`,
          coordinate: [
            result.longitude,
            result.latitude,
          ] as [number, number],
          label: result.ip,
          origin: result.provider,
          precision: 'Estimativa regional por IP',
          details: [
            result.city,
            result.region,
            result.country,
            result.asn,
            result.organization,
          ].filter(Boolean).join(' · ') || null,
        }),
      ),
      ...(geographicSearchResult
        ? [{
          id: `search:${geographicSearchResult.id}`,
          coordinate: [
            geographicSearchResult.longitude,
            geographicSearchResult.latitude,
          ] as [number, number],
          label: geographicSearchResult.name,
          origin:
            geographicSearchResult.provider === 'local'
              ? 'Coordenada manual'
              : 'Photon / OpenStreetMap',
          precision:
            geographicSearchResult.provider === 'local'
              ? 'Precisão definida pelo usuário'
              : 'Localização aproximada',
          details: geographicSearchResult.label,
        }]
        : []),
    ],
    [
      geographicSearchResult,
      ipIntelligence.allResults,
      profileMarkers,
    ],
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
  const inspectorSelectionId = selectedMarker?.id ?? [...LOCATION_LEVELS].reverse().map((level) => locationSelection[level]?.id).find(Boolean);
  useEffect(() => { if (inspectorSelectionId) setInspectorDetailsOpen(true); }, [inspectorSelectionId]);
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

  const copyText =
    useCallback(
      (
        text: string,
        target: string,
      ): void => {
        try {
          const operation =
            window.zeroHub.clipboard
            .writeText(text);

          void operation
            .then(() => {
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
            })
            .catch((unknownError) => {
              setLocatorFeedback({
                message:
                  unknownError instanceof Error
                    ? unknownError.message
                    : 'Não foi possível copiar o conteúdo.',
                tone: 'error',
              });
            });
        } catch (unknownError) {
          setLocatorFeedback({
            message:
              unknownError instanceof Error
                ? unknownError.message
                : 'Não foi possível copiar o conteúdo.',
            tone: 'error',
          });
        }
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
        copyText(
          formatCoordinates(
            latitude,
            longitude,
          ),
          target,
        );
      },
      [copyText],
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
  basemapStyleRef.current =
    basemapStyle;
  persistMapCameraRef.current = () => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReadyRef.current
    ) {
      return;
    }

    const camera = readMapCamera(map);

    onMapWorkspaceViewChange(
      (current) =>
        camerasApproximatelyEqual(
          current.camera,
          camera,
        )
          ? current
          : {
            ...current,
            camera,
          },
    );
  };
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
        maxZoom: 18,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        renderWorldCopies: false,
        cooperativeGestures: false,
      });

    mapRef.current = map;
    const scaleControl = new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' });
    map.addControl(scaleControl, 'bottom-left');

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

    let detailedTileObserved = false;

    const emitViewport = () => {
      const bounds = map.getBounds();
      const normalizeLongitude = (
        longitude: number,
      ) => ((longitude + 180) % 360 + 360) %
        360 - 180;
      const viewport = {
        west: normalizeLongitude(
          bounds.getWest(),
        ),
        south: Math.max(
          -90,
          Math.min(90, bounds.getSouth()),
        ),
        east: normalizeLongitude(
          bounds.getEast(),
        ),
        north: Math.max(
          -90,
          Math.min(90, bounds.getNorth()),
        ),
      };

      onMapViewportChange(viewport);
    };

    const activateDetailedBasemap = (
      force = false,
    ): void => {
      if (!mapReadyRef.current) {
        return;
      }

      if (
        !force &&
        map.getZoom() <
          DETAILED_BASEMAP_MIN_ZOOM
      ) {
        return;
      }

      if (
        map.getSource(
          'detailed-basemap',
        ) &&
        !force
      ) {
        return;
      }

      try {
        if (force) {
          removeDetailedBasemap(map);
        }

        detailedTileObserved = false;
        setDetailedBasemapStatus(
          'loading',
        );
        addDetailedBasemap(map);
        applyDetailedBasemapColors(
          map,
          basemapStyleRef.current,
        );
      } catch (unknownError) {
        console.warn(
          'Falha ao ativar o mapa detalhado.',
          unknownError,
        );
        setDetailedBasemapStatus(
          'unavailable',
        );
      }
    };

    detailedBasemapRetryRef.current =
      () => {
        activateDetailedBasemap(true);
      };

    const handleReady = () => {
      map.setProjection({
        type: 'globe',
      });
      updateMarkerVisualScale(map);
      mapReadyRef.current = true;
      setMapReady(true);
      onMapInstanceChange(map);
      scheduleViewportUpdate();
      emitViewport();
      activateDetailedBasemap();
    };

    const handleMoveEnd = () => {
      emitViewport();
      persistMapCameraRef.current();

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

    const handleSourceData = (
      event: {
        isSourceLoaded?: boolean;
        sourceId?: string;
        tile?: unknown;
      },
    ) => {
      if (
        event.sourceId ===
          'detailed-basemap'
      ) {
        detailedTileObserved =
          detailedTileObserved ||
          Boolean(event.tile);

        if (
          !event.isSourceLoaded ||
          !detailedTileObserved
        ) {
          return;
        }

        setDetailedBasemapStatus(
          'available',
        );
      }
    };
    const handleIdle = () => {
      if (
        !map.getSource(
          'detailed-basemap',
        ) ||
        map.getZoom() <
          DETAILED_BASEMAP_MIN_ZOOM ||
        !map.isSourceLoaded(
          'detailed-basemap',
        ) ||
        !map.areTilesLoaded()
      ) {
        return;
      }

      setDetailedBasemapStatus(
        'available',
      );
    };
    const handleMapError = (
      event: {
        error?: Error;
        sourceId?: string;
      },
    ) => {
      const message =
        event.error?.message ?? '';

      if (
        event.sourceId ===
          'detailed-basemap' ||
        message.includes(
          'tiles.openfreemap.org',
        ) ||
        message.includes(
          'detailed-basemap',
        )
      ) {
        setDetailedBasemapStatus(
          'unavailable',
        );
        return;
      }

      console.error(
        'Falha inesperada ao carregar o mapa.',
        event.error,
      );
    };

    const handleZoom = () => {
      updateMarkerVisualScale(map);
      activateDetailedBasemap();
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
    map.on('zoom', handleZoom);
    map.on('sourcedata', handleSourceData);
    map.on('idle', handleIdle);
    map.on('error', handleMapError);

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

      locationRestoreCameraCleanup.current?.();
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
      map.off('zoom', handleZoom);
      map.off(
        'sourcedata',
        handleSourceData,
      );
      map.off('idle', handleIdle);
      map.off('error', handleMapError);
      detailedBasemapRetryRef.current =
        () => undefined;
      map.removeControl(scaleControl);
      map.remove();
      mapReadyRef.current = false;
      mapRef.current = null;
      onMapInstanceChange(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReady ||
      pendingLocationCamera.current !== null ||
      locationRestoreCameraMoving.current ||
      camerasApproximatelyEqual(
        readMapCamera(map),
        mapWorkspaceView.camera,
      )
    ) {
      return;
    }

    map.stop();
    map.jumpTo({
      bearing:
        mapWorkspaceView.camera.bearing,
      center: [
        mapWorkspaceView.camera.longitude,
        mapWorkspaceView.camera.latitude,
      ],
      pitch:
        mapWorkspaceView.camera.pitch,
      zoom: mapWorkspaceView.camera.zoom,
    });
  }, [
    mapReady,
    mapWorkspaceView.camera,
  ]);

  useEffect(() => {
    if (
      !universalMapCommand ||
      handledUniversalCommandRef.current ===
        universalMapCommand.id
    ) {
      return;
    }

    handledUniversalCommandRef.current =
      universalMapCommand.id;

    switch (universalMapCommand.kind) {
      case 'lookup-ip':
        if (universalMapCommand.value) {
          ipIntelligence.lookupIp(
            universalMapCommand.value,
          );
        }
        break;

      case 'open-ip':
        ipIntelligence.openPanel();
        break;

      case 'toggle-monochrome':
        toggleMonochromeMode();
        break;

      case 'show-markers':
        showAllLayers();
        break;

      case 'copy-center': {
        const center = mapRef.current
          ?.getCenter();
        if (center) {
          copyCoordinates(
            center.lat,
            center.lng,
            'map-center',
          );
        }
        break;
      }

      case 'mark-center': {
        const center = mapRef.current
          ?.getCenter();
        if (center) {
          addTransientMarker(
            center.lat,
            center.lng,
            'typed',
          );
        }
        break;
      }

      case 'clear-transient':
        setTransientMarkers([]);
        setSelectedMarkerId(null);
        setPopoverMarkerId(null);
        onClearGeographicSearch();
        for (
          const result of
          ipIntelligence.allResults
        ) {
          if (!result.saved) {
            ipIntelligence
              .removeTransientResult(
                result.id,
              );
          }
        }
        break;
    }
  }, [
    addTransientMarker,
    copyCoordinates,
    ipIntelligence,
    onClearGeographicSearch,
    showAllLayers,
    toggleMonochromeMode,
    universalMapCommand,
  ]);

  const centerGeographicSearchResult =
    useCallback(() => {
      const map = mapRef.current;
      const result =
        geographicSearchResult;

      if (
        !map ||
        !mapReadyRef.current ||
        !result
      ) {
        return;
      }

      const bounds = result.boundingBox;

      if (
        bounds &&
        bounds.west <= bounds.east
      ) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          {
            padding: 90,
            maxZoom: 16,
            duration:
              reducedMotionRef.current
                ? 0
                : 700,
          },
        );
        return;
      }

      map.flyTo({
        center: [
          result.longitude,
          result.latitude,
        ],
        zoom: Math.max(
          map.getZoom(),
          result.type === 'country'
            ? 4
            : result.type === 'region'
              ? 6
              : result.type === 'city'
                ? 10
                : 15,
        ),
        duration:
          reducedMotionRef.current
            ? 0
            : 700,
        essential: false,
      });
    }, [geographicSearchResult]);

  useEffect(() => {
    centerGeographicSearchResult();
  }, [centerGeographicSearchResult]);

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
      rotationEnabled && providerVisible;

    const map = mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    if (rotationEnabled && providerVisible) {
      startAutoRotation();
      return;
    }

    map.stop();
  }, [
    mapReady,
    providerVisible,
    rotationEnabled,
    startAutoRotation,
  ]);

  useEffect(() => {
    if (!mapReady) {
      return undefined;
    }

    const resizeFrame =
      window.requestAnimationFrame(
        () => {
          mapRef.current?.resize();
        },
      );

    return () => {
      window.cancelAnimationFrame(
        resizeFrame,
      );
    };
  }, [cleanMapMode, mapReady]);

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
      basemapStyle === 'tactical'
        ? '#081116'
        : basemapStyle ===
          'streets-light'
        ? '#dbe3e7'
        : '#030303',
    );
    map.setPaintProperty(
      'countries-fill',
      'fill-color',
      basemapStyle === 'tactical'
        ? '#202827'
        : basemapStyle ===
          'streets-light'
        ? '#e7e3da'
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
      basemapStyle === 'tactical'
        ? 'rgba(220,235,233,0.34)'
        : basemapStyle ===
          'streets-light'
        ? 'rgba(49,58,63,0.32)'
        : 'rgba(255,255,255,0.16)',
    );
    map.setPaintProperty(
      'admin1-border',
      'line-color',
      basemapStyle === 'tactical'
        ? 'rgba(220,235,233,0.22)'
        : basemapStyle ===
          'streets-light'
        ? 'rgba(49,58,63,0.2)'
        : 'rgba(255,255,255,0.08)',
    );
    map.setPaintProperty(
      'city-points',
      'circle-color',
      basemapStyle === 'tactical'
        ? 'rgba(255,255,255,0.82)'
        : basemapStyle ===
          'streets-light'
        ? 'rgba(44,54,59,0.74)'
        : 'rgba(255,255,255,0.72)',
    );
    map.setPaintProperty(
      'map-labels',
      'text-color',
      basemapStyle === 'tactical'
        ? [
          'match',
          ['get', 'kind'],
          'country',
          'rgba(255,255,255,0.88)',
          'admin1',
          'rgba(255,255,255,0.72)',
          'rgba(255,255,255,0.8)',
        ]
        : basemapStyle ===
          'streets-light'
        ? [
          'match',
          ['get', 'kind'],
          'country',
          'rgba(28,35,39,0.82)',
          'admin1',
          'rgba(45,53,57,0.68)',
          'rgba(52,60,64,0.74)',
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
    applyDetailedBasemapColors(
      map,
      basemapStyle,
    );
    map.setPaintProperty(
      'map-labels',
      'text-halo-color',
      basemapStyle ===
        'streets-light'
        ? 'rgba(255,255,255,0.92)'
        : monochromeMode
        ? 'rgba(0,0,0,0.94)'
        : 'rgba(0,0,0,0.82)',
    );
  }, [basemapStyle, monochromeMode]);

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

  const focusIpResult = useCallback(
    (result: IpGeolocationResult) => {
      centerCoordinates(
        result.latitude,
        result.longitude,
      );
    },
    [centerCoordinates],
  );

  const copyIpResult = useCallback(
    (result: IpGeolocationResult) => {
      copyText(
        result.ip,
        `ip:${result.id}`,
      );
    },
    [copyText],
  );

  const copyIpResultCoordinates =
    useCallback(
      (result: IpGeolocationResult) => {
        copyCoordinates(
          result.latitude,
          result.longitude,
          `ip-coordinates:${result.id}`,
        );
      },
      [copyCoordinates],
    );

  const copyIpResultSummary =
    useCallback(
      (result: IpGeolocationResult) => {
        copyText(
          formatIpGeolocationSummary(
            result,
          ),
          `ip-summary:${result.id}`,
        );
      },
      [copyText],
    );

  const openIpResultRdap = useCallback(
    (result: IpGeolocationResult) => {
      onOpenIpRdap(result.ip);
    },
    [onOpenIpRdap],
  );

  const copyGeographicSearchResult =
    useCallback((): void => {
      if (!geographicSearchResult) {
        return;
      }

      copyCoordinates(
        geographicSearchResult.latitude,
        geographicSearchResult.longitude,
        `geographic-search:${geographicSearchResult.id}`,
      );
    }, [
      copyCoordinates,
      geographicSearchResult,
    ]);

  const saveGeographicSearchResult =
    useCallback((): void => {
      if (!geographicSearchResult) {
        return;
      }

      const marker = addTransientMarker(
        geographicSearchResult.latitude,
        geographicSearchResult.longitude,
        'typed',
      );
      updateTransientMarker(marker.id, {
        name: geographicSearchResult.name,
      });
    }, [
      addTransientMarker,
      geographicSearchResult,
      updateTransientMarker,
    ]);

  const reverseGeographicSearchResult =
    useCallback((): void => {
      if (!geographicSearchResult) {
        return;
      }

      void onReverseGeographicSearch(
        geographicSearchResult.latitude,
        geographicSearchResult.longitude,
      );
    }, [
      geographicSearchResult,
      onReverseGeographicSearch,
    ]);

  useIbgeMunicipality({
    selection: locationSelection,
    setSelection: setLocationSelection,
    onStatus: setLocationFeedback,
    onBoundary: (geometry) => {
      const map = mapRef.current;
      if (!map || !mapReady || !providerVisible || !locationAutoZoom || locationSelection.neighbourhood || locationSelection.street || locationSelection.exact) return;
      const bounds = geometryBounds(geometry);
      if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: reducedMotionRef.current ? 0 : 450 });
    },
    onUnavailable: () => {
      const city = locationSelection.city;
      if (!city || !mapRef.current || !mapReady || !providerVisible || !locationAutoZoom || locationSelection.neighbourhood || locationSelection.street || locationSelection.exact) return;
      mapRef.current.flyTo({ center: [city.longitude, city.latitude], zoom: 10, duration: reducedMotionRef.current ? 0 : 450, essential: false });
    },
  });

  useRecifeGeometry({
    selection: locationSelection,
    setSelection: setLocationSelection,
    onStatus: setLocationFeedback,
    onGeometry: (level, geometry) => {
      const map = mapRef.current;
      if (!map || !mapReady || !providerVisible || !locationAutoZoom || locationSelection.exact || (level === 'neighbourhood' && locationSelection.street)) return;
      const bounds = geometryBounds(geometry);
      if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: level === 'street' ? 16 : 14, duration: reducedMotionRef.current ? 0 : 450 });
    },
    onUnavailable: (level) => {
      const place = locationSelection[level];
      if (!place || !mapRef.current || !mapReady || !providerVisible || !locationAutoZoom || locationSelection.exact || (level === 'neighbourhood' && locationSelection.street)) return;
      mapRef.current.flyTo({ center: [place.longitude, place.latitude], zoom: level === 'street' ? 15 : 12, duration: reducedMotionRef.current ? 0 : 450, essential: false });
    },
  });

  function restoreLocationActivity(activityId: string): void {
    const activity = activeCase?.activities.find((item) => item.id === activityId && item.action === 'hierarchical-location-saved');
    const restored = activity && restoreSavedLocation(activity.output, countriesData, admin1Data);
    if (!restored) { setLocationFeedback('Não foi possível restaurar esta localização salva.'); return; }
    setSelectedMarkerId(null);
    setPopoverMarkerId(null);
    pendingLocationCamera.current = locationAutoZoom ? restored : null;
    setLocationSelection(restored);
    setLocationRestoreRevision((value) => value + 1);
    setLocationFeedback('Localização restaurada; limites disponíveis serão recuperados.');
  }

  useEffect(() => {
    if (caseLoading || locationCaseRef.current === activeCaseId) return;
    const previousCase = locationCaseRef.current;
    locationCaseRef.current = activeCaseId;
    const activity = activeCase?.activities.find((item) => item.action === 'hierarchical-location-saved');
    if (activity) {
      const restored = restoreSavedLocation(activity.output, countriesData, admin1Data);
      if (restored) { setSelectedMarkerId(null); setPopoverMarkerId(null); }
      pendingLocationCamera.current = locationAutoZoom ? restored : null;
      setLocationSelection(restored ?? {});
      setLocationFeedback(restored ? 'Localização do case restaurada; recuperando limites disponíveis.' : 'A localização salva é incompatível ou está incompleta.');
      setLocationRestoreRevision((value) => value + 1);
    } else if (previousCase) {
      pendingLocationCamera.current = null;
      setLocationSelection({});
      setLocationFeedback(null);
      setLocationRestoreRevision((value) => value + 1);
    }
  }, [activeCase, activeCaseId, caseLoading, locationAutoZoom]);

  useEffect(() => {
    const restored = pendingLocationCamera.current;
    if (!restored || LOCATION_LEVELS.some((level) => restored[level]?.id !== locationSelection[level]?.id)) return;
    if (!locationAutoZoom) { pendingLocationCamera.current = null; return; }
    const map = mapRef.current;
    if (!map || !mapReady || !providerVisible) return;
    pendingLocationCamera.current = null;
    const camera = restoredLocationCamera(locationSelection);
    if (!camera) return;
    locationRestoreCameraCleanup.current?.();
    map.stop();
    locationRestoreCameraMoving.current = true;
    let timer: number | null = window.setTimeout(finish, 2000);
    function finish(): void {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      map?.off('moveend', onMoveEnd);
      locationRestoreCameraMoving.current = false;
      if (locationRestoreCameraCleanup.current === finish) locationRestoreCameraCleanup.current = null;
    }
    function onMoveEnd(): void {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(finish, 100);
    }
    locationRestoreCameraCleanup.current = finish;
    map.on('moveend', onMoveEnd);
    const duration = reducedMotionRef.current ? 0 : 450;
    if ('bounds' in camera) map.fitBounds(camera.bounds, { padding: 40, maxZoom: camera.maxZoom, duration });
    else map.flyTo({ center: camera.center, zoom: camera.zoom, duration, essential: false });
  }, [locationSelection, locationAutoZoom, mapReady, providerVisible]);

  function selectHierarchicalLocation(level: LocationLevel, result: GeographicSearchResult | null): void {
    locationRestoreCameraCleanup.current?.();
    pendingLocationCamera.current = null;
    const resolved = result ? resolveLocalBoundary(level, result, locationSelection, countriesData, admin1Data) : null;
    const next = selectLocationLevel(locationSelection, level, resolved);
    if (next === locationSelection) return;
    if (resolved) { setSelectedMarkerId(null); setPopoverMarkerId(null); }
    setLocationSelection(next);
    setLocationFeedback(null);
    const map = mapRef.current;
    if (!resolved || !map || !mapReady || !locationAutoZoom) return;
    if (level === 'city' && !resolved.geometry && ibgeStateForSelection(next)) return;
    if (!resolved.geometry && next.city?.officialCode === '2611606' && next.city.geometryMetadata?.source === 'IBGE · Malhas municipais' && (level === 'neighbourhood' || (level === 'street' && next.neighbourhood?.officialCode && next.neighbourhood.geometryMetadata?.source === 'Prefeitura do Recife · Bairros'))) return;
    const bounds = resolved.geometry && geometryBounds(resolved.geometry);
    const duration = reducedMotionRef.current ? 0 : 450;
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: level === 'country' ? 5 : level === 'city' ? 11 : 9, duration });
    } else {
      map.flyTo({ center: [resolved.longitude, resolved.latitude], zoom: level === 'city' ? 10 : level === 'exact' ? 15 : 12, duration, essential: false });
    }
  }

  function createLocationMarker(): void {
    const selected = [...LOCATION_LEVELS].reverse().map((level) => locationSelection[level]).find(Boolean);
    if (!selected) return;
    const marker = addTransientMarker(selected.latitude, selected.longitude, 'typed');
    updateTransientMarker(marker.id, { name: selected.name });
    setLocationFeedback(selected.sourceId === 'user-coordinate' ? 'Marcador criado com a coordenada informada.' : 'Marcador criado com a coordenada aproximada da seleção.');
  }

  async function saveHierarchicalLocation(): Promise<void> {
    if (!activeCase || locationSavingRef.current) return;
    const levels = LOCATION_LEVELS.flatMap((level) => {
      const item = locationSelection[level];
      return item ? [{ level, id: item.id, name: item.name, type: item.type, sourceId: item.sourceId, latitude: item.latitude, longitude: item.longitude, source: item.provider, approximate: item.approximate, geometrySource: item.geometryMetadata?.source ?? null, officialCode: item.officialCode ?? null }] : [];
    });
    if (!levels.length) return;
    const locationKey = JSON.stringify(levels.map(({ level, id }) => [level, id]));
    if (activeCase.activities.some((activity) => activity.action === 'hierarchical-location-saved' && typeof activity.input === 'object' && activity.input !== null && 'locationKey' in activity.input && activity.input.locationKey === locationKey)) {
      setLocationFeedback('Esta seleção já foi registrada neste case.');
      return;
    }
    locationSavingRef.current = true;
    setLocationSaving(true);
    try {
      await addActivity({ caseId: activeCase.id, moduleId: 'map-workspace', action: 'hierarchical-location-saved', title: `Localização: ${levels.map((item) => item.name).join(' › ')}`.slice(0, 180), status: 'success', input: { locationKey }, output: { levels } });
      setLocationFeedback('Localização registrada no case.');
    } catch {
      setLocationFeedback('Não foi possível registrar a localização.');
    } finally {
      locationSavingRef.current = false;
      setLocationSaving(false);
    }
  }

  return (
    <div
      data-panel-open={coordinatePanelOpen || mapWorkspaceView.layerManagerOpen || ipIntelligence.open || locationPanelOpen}
      data-inspector-open={mapWorkspaceView.operationalHudOpen || Boolean(geographicSearchResult) || Boolean(inspectorSelectionId && inspectorDetailsOpen)}
      className={`worldGlobeMap ${
        monochromeMode
          ? 'isMonochrome'
          : ''
      } ${
        basemapStyle === 'streets-light'
          ? 'isStreetsLight'
          : ''
      } ${
        cleanMapMode
          ? 'isCleanMapMode'
          : ''
      }`}
    >
      <div
        className="worldGlobeMapCanvas"
        ref={containerRef}
      />

      <div
        className="detailedBasemapAttribution"
        data-state={detailedBasemapStatus}
        role="status"
        aria-live="polite"
      >
        {detailedBasemapStatus ===
          'available' &&
          DETAILED_BASEMAP_PROVIDER
            .attribution}
        {detailedBasemapStatus ===
          'local' &&
          'Mapa local Natural Earth · detalhes online a partir do zoom urbano'}
        {detailedBasemapStatus ===
          'loading' &&
          'Carregando detalhes online…'}
        {detailedBasemapStatus ===
          'unavailable' && (
          <>
            <span>
              Detalhes online indisponíveis · fallback local Natural Earth
            </span>
            <button
              type="button"
              onClick={() => {
                detailedBasemapRetryRef
                  .current();
              }}
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>

      <GeographicTimelineMapLayer
        event={
          hiddenOperationalLayerSet.has(
            'geographic-timeline',
          )
            ? null
            : geographicTimeline.activeEvent
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

      <IpGeolocationMapLayer
        connectResults={
          ipIntelligence.connectResults
        }
        map={
          mapReady
            ? mapRef.current
            : null
        }
        results={visibleIpResults}
        selectedResultId={
          ipIntelligence
            .selectedResult?.id ?? null
        }
        onSelect={
          ipIntelligence.focusResult
        }
        onError={
          ipIntelligence.reportMapError
        }
      />

      <GeographicSearchMapLayer
        map={
          mapReady
            ? mapRef.current
            : null
        }
        result={
          hiddenOperationalLayerSet.has(
            'geographic-search',
          )
            ? null
            : geographicSearchResult
        }
        onSelect={
          centerGeographicSearchResult
        }
      />

      <LocationSelectionMapLayer map={mapReady ? mapRef.current : null} selection={hiddenOperationalLayerSet.has('location-selection') ? EMPTY_LOCATION_SELECTION : locationSelection} />

      <div
        className="worldGlobeHud"
        aria-hidden={cleanMapMode}
        inert={cleanMapMode}
      >

      {!mapReady && (
        <div className="worldMapEmptyState">
          Inicializando globo local...
        </div>
      )}

      {markerCount === 0 &&
        profileMarkers.length === 0 &&
          ipIntelligence.allResults.length ===
          0 &&
        mapReady && (
          <div className="worldMapEmptyState">
            Nenhuma coordenada cadastrada nos cases.
          </div>
        )}

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

      <SignalLab map={mapReady ? mapRef.current : null} active={providerVisible && !cleanMapMode} />

      <MapMeasurementTools
        activeCaseName={activeCase?.name ?? null}
        map={
          mapReady
            ? mapRef.current
            : null
        }
        scopeId={
          activeCaseId ?? 'no-case'
        }
        visible={
          !hiddenOperationalLayerSet.has(
            'measurements',
          )
        }
        onCountChange={
          setMeasurementPointCount
        }
        onSaveToCase={activeCase
          ? async (data, mode, summary) => {
            await addActivity({
              caseId: activeCase.id,
              moduleId: 'map-workspace',
              action: 'map-measurement-saved',
              title: `Medição geográfica: ${summary}`,
              status: 'success',
              input: { mode },
              output: data,
            });
          }
          : undefined}
      />

      <MapGeoJsonTools
        activeCaseName={activeCase?.name ?? null}
        exportData={exportableMapData}
        map={
          mapReady
            ? mapRef.current
            : null
        }
        scopeId={
          activeCaseId ?? 'no-case'
        }
        visible={
          !hiddenOperationalLayerSet.has(
            'imported-geojson',
          )
        }
        onCountChange={
          setImportedGeoJsonCount
        }
        onBoundsChange={setImportedGeoJsonBounds}
        onSaveToCase={activeCase
          ? async (data) => {
            await addActivity({
              caseId: activeCase.id,
              moduleId: 'map-workspace',
              action: 'map-geojson-import-saved',
              title: `GeoJSON registrado: ${data.features.length} feature(s)`,
              status: 'success',
              output: data,
            });
          }
          : undefined}
      />

      <MapLayerPresentation map={mapReady ? mapRef.current : null} settings={visualLayerSettings} />

      <MapComparisonPanel
        items={comparisonItems}
        map={
          mapReady
            ? mapRef.current
            : null
        }
        scopeId={
          activeCaseId ?? 'no-case'
        }
        visible={
          !hiddenOperationalLayerSet.has(
            'comparison',
          )
        }
        onCountChange={
          setComparisonSelectionCount
        }
      />
      </div>

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

      <aside className="worldGlobeInspector" aria-label="Informações do mapa" aria-hidden={cleanMapMode} inert={cleanMapMode}>
      {inspectorSelectionId && (inspectorDetailsOpen ? <MapContextInspector marker={selectedMarker ?? null} selection={locationSelection} caseName={activeCase?.name ?? null} onClose={() => setInspectorDetailsOpen(false)} /> : <button className="mapContextReopen" type="button" aria-label="Mostrar detalhes da seleção" title="Mostrar detalhes da seleção" onClick={() => setInspectorDetailsOpen(true)}>i</button>)}
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
        totalIpResults={
          ipIntelligence.allResults.length
        }
        totalMarkers={
          profileMarkers.length
        }
        visibleIpResults={
          visibleIpResults.length
        }
        visibleMarkers={
          visibleMarkers.length
        }
        onOpenChange={
          setOperationalHudOpen
        }
      />

      <GeographicSearchResultPanel
        busy={geographicSearchBusy}
        copied={
          geographicSearchResult !== null &&
          copiedTarget ===
            `geographic-search:${geographicSearchResult.id}`
        }
        favorite={
          geographicSearchResultFavorite
        }
        result={geographicSearchResult}
        onCenter={
          centerGeographicSearchResult
        }
        onClear={onClearGeographicSearch}
        onCopy={
          copyGeographicSearchResult
        }
        onReverse={
          reverseGeographicSearchResult
        }
        onSaveMarker={
          saveGeographicSearchResult
        }
        onToggleFavorite={
          onToggleGeographicFavorite
        }
      />

      </aside>

      <div
        className="worldGlobeTools"
        aria-hidden={cleanMapMode}
        inert={cleanMapMode}
      >
        <div className="worldGlobePanels" data-active={activeWorkspacePanel}>
          <HierarchicalLocationPanel key={locationRestoreRevision} open={locationPanelOpen} active={providerVisible && !cleanMapMode} selection={locationSelection} countries={countriesData} regions={admin1Data} autoZoom={locationAutoZoom} caseName={activeCase?.name ?? null} savedLocations={(activeCase?.activities ?? []).filter((item) => item.action === 'hierarchical-location-saved').map((item) => ({ id: item.id, title: item.title }))} busy={locationSaving || caseLoading || caseMutating} feedback={locationFeedback} onClose={() => setLocationPanelOpen(false)} onSelect={selectHierarchicalLocation} onClear={() => { pendingLocationCamera.current = null; setLocationSelection({}); setLocationFeedback(null); }} onAutoZoom={setLocationAutoZoom} onSave={() => { void saveHierarchicalLocation(); }} onRestore={restoreLocationActivity} onMarker={createLocationMarker} />
          <IpGeolocationPanel
            activeCaseName={
              activeCase?.name ?? null
            }
            allResults={
              ipIntelligence.allResults
            }
            busy={ipIntelligence.busy}
            caseBusy={
              caseLoading ||
              caseMutating
            }
            connectResults={
              ipIntelligence.connectResults
            }
            copiedTarget={copiedTarget}
            feedback={ipIntelligence.feedback}
            history={ipIntelligence.history}
            input={ipIntelligence.input}
            open={ipIntelligence.open}
            publicFamilyStatuses={
              ipIntelligence
                .publicFamilyStatuses
            }
            results={ipIntelligence.results}
            savingResultId={
              ipIntelligence.savingResultId
            }
            selectedResult={
              ipIntelligence.selectedResult
            }
            versionFilter={
              ipIntelligence.versionFilter
            }
            onCancel={ipIntelligence.cancel}
            onClear={ipIntelligence.clear}
            onClose={ipIntelligence.close}
            onColorChange={
              ipIntelligence.setColor
            }
            onConnectResultsChange={
              ipIntelligence
                .setConnectResults
            }
            onCopyCoordinates={
              copyIpResultCoordinates
            }
            onCopyIp={copyIpResult}
            onCopySummary={
              copyIpResultSummary
            }
            onFocus={focusIpResult}
            onHistorySelect={
              ipIntelligence.focusResult
            }
            onInputChange={
              ipIntelligence.setInput
            }
            onLookup={ipIntelligence.lookup}
            onLookupPublicIp={
              ipIntelligence.lookupPublicIp
            }
            onOpenRdap={openIpResultRdap}
            onRemoveHistory={
              ipIntelligence.removeHistory
            }
            onRemoveResult={
              ipIntelligence
                .removeTransientResult
            }
            onResultSelect={
              ipIntelligence.focusResult
            }
            onSave={ipIntelligence.saveResult}
            onVersionFilterChange={
              ipIntelligence
                .setVersionFilter
            }
          />

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
            hiddenOperationalLayers={
              mapWorkspaceView
                .hiddenOperationalLayers
            }
            ipIntelligenceVisible={
              mapWorkspaceView
                .ipIntelligenceVisible
            }
            ipResults={
              ipIntelligence.allResults
            }
            markers={profileMarkers}
            operationalLayers={
              operationalLayers
            }
            visualSettings={visualLayerSettings}
            zoomableLayers={zoomableVisualLayers}
            onOpacityChange={changeVisualOpacity}
            onMoveLayer={moveVisualLayer}
            onZoomLayer={zoomVisualLayer}
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
            onToggleIpIntelligence={
              toggleIpIntelligence
            }
            onToggleOperationalLayer={
              toggleOperationalLayer
            }
          />
        </div>

        <div
          className="worldGlobeControls"
          aria-label="Controles do mapa"
        >
          <button type="button" aria-label={locationPanelOpen && activeWorkspacePanel === 'location' ? 'Recolher localização hierárquica' : 'Abrir localização hierárquica'} title={locationPanelOpen && activeWorkspacePanel === 'location' ? 'Recolher localização hierárquica' : 'Abrir localização hierárquica'} aria-expanded={locationPanelOpen} onClick={() => { if (!locationPanelOpen || activeWorkspacePanel === 'location') setLocationPanelOpen((open) => !open); setActiveWorkspacePanel('location'); }}><WorkspaceIcon name="location" /></button>
          <button
            type="button"
            aria-label="Aproximar mapa"
            title="Aproximar mapa"
            onClick={() => {
              mapRef.current?.zoomIn({
                duration:
                  reducedMotionRef.current
                    ? 0
                    : 220,
              });
            }}
          >
            <WorkspaceIcon name="plus" />
          </button>

          <button
            type="button"
            aria-label="Afastar mapa"
            title="Afastar mapa"
            onClick={() => {
              mapRef.current?.zoomOut({
                duration:
                  reducedMotionRef.current
                    ? 0
                    : 220,
              });
            }}
          >
            <WorkspaceIcon name="minus" />
          </button>

          <button
            type="button"
            aria-label="Recentralizar globo"
            title="Recentralizar globo"
            onClick={recenterMap}
          >
            <WorkspaceIcon name="target" />
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
            title={rotationEnabled && timelineCameraMoving ? 'Desativar rotação automática pausada pela Timeline Geográfica' : rotationEnabled ? 'Pausar rotação automática' : 'Iniciar rotação automática'}
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
              : <WorkspaceIcon name={rotationEnabled ? 'pause' : 'play'} />}
          </button>

          <button
            type="button"
            aria-label={
              monochromeMode
                ? 'Desativar preto e branco'
                : 'Ativar preto e branco'
            }
            aria-pressed={monochromeMode}
            title={monochromeMode ? 'Desativar preto e branco' : 'Ativar preto e branco'}
            onClick={toggleMonochromeMode}
          >
            P/B
          </button>

          <label
            className="mapBasemapStyleControl"
            title="Escolher estilo cartográfico"
          >
            <span className="srOnly">
              Layout do mapa
            </span>
            <select
              aria-label="Layout do mapa"
              value={basemapStyle}
              onChange={(event) => {
                setBasemapStyle(
                  event.currentTarget
                    .value as MapBasemapStyle,
                );
              }}
            >
              <option value="tactical">
                Tactical
              </option>
              <option value="streets-dark">
                Streets Dark
              </option>
              <option value="streets-light">
                Streets Light
              </option>
            </select>
          </label>

          <button
            className="ipGeolocationToggle"
            type="button"
            aria-controls="ip-geolocation-panel"
            aria-expanded={
              ipIntelligence.open
            }
            aria-label={
              ipIntelligence.open && activeWorkspacePanel === 'ip'
                ? 'Minimizar IP Intelligence'
                : 'Abrir IP Intelligence'
            }
            title={ipIntelligence.open && activeWorkspacePanel === 'ip' ? 'Minimizar IP Intelligence' : 'Abrir IP Intelligence'}
            onClick={() => { if (!ipIntelligence.open) ipIntelligence.openPanel(); else if (activeWorkspacePanel === 'ip') ipIntelligence.close(); setActiveWorkspacePanel('ip'); }}
          >
            <span aria-hidden="true">IP</span>
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
              mapWorkspaceView.layerManagerOpen && activeWorkspacePanel === 'layers'
                ? 'Ocultar gerenciador de camadas'
                : 'Mostrar gerenciador de camadas'
            }
            title={mapWorkspaceView.layerManagerOpen && activeWorkspacePanel === 'layers' ? 'Ocultar gerenciador de camadas' : 'Mostrar gerenciador de camadas'}
            onClick={() => { if (!mapWorkspaceView.layerManagerOpen || activeWorkspacePanel === 'layers') toggleLayerManager(); setActiveWorkspacePanel('layers'); }}
          >
            <WorkspaceIcon name="layers" />
          </button>

          <button
            className="coordinatePanelToggle"
            type="button"
            aria-controls="workspace-coordinate-panel"
            aria-expanded={
              coordinatePanelOpen
            }
            aria-label={
              coordinatePanelOpen && activeWorkspacePanel === 'markers'
                ? 'Ocultar painel de coordenadas'
                : 'Mostrar painel de coordenadas'
            }
            title={
              coordinatePanelOpen && activeWorkspacePanel === 'markers'
                ? 'Ocultar painel de coordenadas'
                : 'Mostrar painel de coordenadas'
            }
            onClick={() => {
              if (!coordinatePanelOpen || activeWorkspacePanel === 'markers') setCoordinatePanelOpen((open) => !open);
              setActiveWorkspacePanel('markers');
            }}
          >
            <WorkspaceIcon name="marker" />
          </button>
        </div>
      </div>
    </div>
  );
}
