import {
  MODULE_REGISTRY,
} from '../../shared/modules/module.registry';

import type {
  WorkspaceMode,
} from '../../shared/modules/module.types';

import type {
  PageId,
} from './types';

import {
  DEFAULT_MAP_WORKSPACE_VIEW_STATE,
  MAP_BASEMAP_STYLES,
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
  MAP_OPERATIONAL_LAYER_IDS,
} from '../components/workspace/map-workspace.types';

import type {
  MapCameraState,
  MapBasemapStyle,
  MapLayerColorFilter,
  MapMarkerCategory,
  MapOperationalLayerId,
  MapWorkspaceViewState,
} from '../components/workspace/map-workspace.types';

function isMapBasemapStyle(
  value: unknown,
): value is MapBasemapStyle {
  return MAP_BASEMAP_STYLES.some(
    (style) => style === value,
  );
}

export const MAP_WORKSPACE_DEFAULT_SCOPE =
  'default';
export const MAP_WORKSPACE_NO_CASE_SCOPE =
  'no-case';
const MAX_MAP_WORKSPACE_SCOPES = 100;

export type MapWorkspaceViews = Record<
  string,
  MapWorkspaceViewState
>;

const SESSION_STORAGE_KEYS = {
  activePage:
    'zerohub.ui.active-page.v1',
  favoriteIds:
    'zerohub.ui.favorites.v1',
  recentIds:
    'zerohub.ui.recents.v1',
  workspaceMode:
    'zerohub.ui.workspace-mode.v1',
  mapWorkspaceView:
    'zerohub.ui.map-workspace-view.v1',
} as const;

export type SessionSnapshot = {
  activePage: PageId;
  favoriteIds: PageId[];
  recentIds: PageId[];
  workspaceMode: WorkspaceMode;
  mapWorkspaceViews:
    MapWorkspaceViews;
};

export const DEFAULT_SESSION_SNAPSHOT:
  SessionSnapshot = {
    activePage: 'dashboard',
    favoriteIds: [],
    recentIds: [],
    workspaceMode: 'osint',
    mapWorkspaceViews: {
      [MAP_WORKSPACE_DEFAULT_SCOPE]: {
        ...DEFAULT_MAP_WORKSPACE_VIEW_STATE,
        camera: {
          ...DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .camera,
        },
      },
    },
  };

function isPageId(
  value: unknown,
): value is PageId {
  return (
    typeof value === 'string' &&
    MODULE_REGISTRY.some(
      (module) =>
        module.id === value,
    )
  );
}

function readStoredPages(
  key: string,
): PageId[] {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          key,
        ) ?? '[]',
      ) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      isPageId,
    );
  } catch {
    return [];
  }
}

function readStoredPage(
  key: string,
  fallback: PageId,
): PageId {
  const value =
    localStorage.getItem(key);

  return isPageId(value)
    ? value
    : fallback;
}

function readWorkspaceMode():
  WorkspaceMode {
  const value =
    localStorage.getItem(
      SESSION_STORAGE_KEYS
        .workspaceMode,
    );

  return value === 'attack'
    ? 'attack'
    : 'osint';
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

function isColorFilter(
  value: unknown,
): value is MapLayerColorFilter {
  return (
    value === 'all' ||
    (
      typeof value === 'string' &&
      MAP_MARKER_COLORS.some(
        (color) =>
          color.id === value,
      )
    )
  );
}

function isOperationalLayerId(
  value: unknown,
): value is MapOperationalLayerId {
  return (
    typeof value === 'string' &&
    MAP_OPERATIONAL_LAYER_IDS.includes(
      value as MapOperationalLayerId,
    )
  );
}

function readFiniteNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  )
    ? value
    : fallback;
}

function parseCamera(
  value: unknown,
): MapCameraState {
  const camera =
    value && typeof value === 'object'
      ? value as Partial<MapCameraState>
      : {};
  const fallback =
    DEFAULT_MAP_WORKSPACE_VIEW_STATE
      .camera;

  return {
    bearing: readFiniteNumber(
      camera.bearing,
      fallback.bearing,
      -360,
      360,
    ),
    latitude: readFiniteNumber(
      camera.latitude,
      fallback.latitude,
      -90,
      90,
    ),
    longitude: readFiniteNumber(
      camera.longitude,
      fallback.longitude,
      -180,
      180,
    ),
    pitch: readFiniteNumber(
      camera.pitch,
      fallback.pitch,
      0,
      85,
    ),
    zoom: readFiniteNumber(
      camera.zoom,
      fallback.zoom,
      0.25,
      18,
    ),
  };
}

function parseMapWorkspaceView(
  value: unknown,
): MapWorkspaceViewState {
    const parsed =
      value && typeof value === 'object'
        ? value as Partial<MapWorkspaceViewState>
        : {};

    const hiddenMarkerCategories =
      Array.isArray(
        parsed.hiddenMarkerCategories,
      )
        ? parsed.hiddenMarkerCategories
          .filter(isMarkerCategory)
        : [];
    const hiddenOperationalLayers =
      Array.isArray(
        parsed.hiddenOperationalLayers,
      )
        ? parsed.hiddenOperationalLayers
          .filter(isOperationalLayerId)
        : [];

    return {
      basemapStyle:
        isMapBasemapStyle(
          parsed.basemapStyle,
        )
          ? parsed.basemapStyle
          : parsed.monochromeMode === true
          ? 'tactical'
          : parsed.monochromeMode === false
          ? 'streets-dark'
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .basemapStyle,
      camera: parseCamera(parsed.camera),
      hiddenMarkerCategories: [
        ...new Set(
          hiddenMarkerCategories,
        ),
      ],
      hiddenOperationalLayers: [
        ...new Set(
          hiddenOperationalLayers,
        ),
      ],
      ipIntelligenceVisible:
        typeof parsed
          .ipIntelligenceVisible ===
          'boolean'
          ? parsed
            .ipIntelligenceVisible
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .ipIntelligenceVisible,
      layerManagerOpen:
        typeof parsed.layerManagerOpen ===
          'boolean'
          ? parsed.layerManagerOpen
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .layerManagerOpen,
      markerColorFilter:
        isColorFilter(
          parsed.markerColorFilter,
        )
          ? parsed.markerColorFilter
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .markerColorFilter,
      monochromeMode:
        isMapBasemapStyle(
          parsed.basemapStyle,
        )
          ? parsed.basemapStyle ===
            'tactical'
          : typeof parsed.monochromeMode ===
            'boolean'
          ? parsed.monochromeMode
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .monochromeMode,
      operationalHudOpen:
        typeof parsed.operationalHudOpen ===
          'boolean'
          ? parsed.operationalHudOpen
          : DEFAULT_MAP_WORKSPACE_VIEW_STATE
            .operationalHudOpen,
    };
}

function isSafeMapWorkspaceScope(
  value: string,
): boolean {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value !== '__proto__' &&
    value !== 'constructor' &&
    value !== 'prototype'
  );
}

function readMapWorkspaceViews():
  MapWorkspaceViews {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        SESSION_STORAGE_KEYS
          .mapWorkspaceView,
      ) ?? '{}',
    ) as unknown;
    const envelope =
      parsed && typeof parsed === 'object'
        ? parsed as {
          version?: unknown;
          views?: unknown;
        }
        : {};

    if (
      envelope.version === 2 &&
      envelope.views &&
      typeof envelope.views === 'object' &&
      !Array.isArray(envelope.views)
    ) {
      const views: MapWorkspaceViews = {};

      for (
        const [scope, view] of Object.entries(
          envelope.views,
        ).slice(0, MAX_MAP_WORKSPACE_SCOPES)
      ) {
        if (isSafeMapWorkspaceScope(scope)) {
          views[scope] =
            parseMapWorkspaceView(view);
        }
      }

      if (
        !views[MAP_WORKSPACE_DEFAULT_SCOPE]
      ) {
        views[MAP_WORKSPACE_DEFAULT_SCOPE] =
          parseMapWorkspaceView(null);
      }

      return views;
    }

    return {
      [MAP_WORKSPACE_DEFAULT_SCOPE]:
        parseMapWorkspaceView(parsed),
    };
  } catch {
    return {
      [MAP_WORKSPACE_DEFAULT_SCOPE]:
        parseMapWorkspaceView(null),
    };
  }
}

export function readSessionSnapshot():
  SessionSnapshot {
  return {
    activePage:
      readStoredPage(
        SESSION_STORAGE_KEYS
          .activePage,
        DEFAULT_SESSION_SNAPSHOT
          .activePage,
      ),
    favoriteIds:
      readStoredPages(
        SESSION_STORAGE_KEYS
          .favoriteIds,
      ),
    recentIds:
      readStoredPages(
        SESSION_STORAGE_KEYS
          .recentIds,
      ),
    workspaceMode:
      readWorkspaceMode(),
    mapWorkspaceViews:
      readMapWorkspaceViews(),
  };
}

export function saveSessionSnapshot(
  snapshot: SessionSnapshot,
): void {
  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .activePage,
    snapshot.activePage,
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .favoriteIds,
    JSON.stringify(
      snapshot.favoriteIds,
    ),
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .recentIds,
    JSON.stringify(
      snapshot.recentIds,
    ),
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .workspaceMode,
    snapshot.workspaceMode,
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .mapWorkspaceView,
    JSON.stringify(
      {
        version: 2,
        views: snapshot.mapWorkspaceViews,
      },
    ),
  );
}

export function clearSessionSnapshot():
  void {
  Object.values(
    SESSION_STORAGE_KEYS,
  ).forEach((key) => {
    localStorage.removeItem(key);
  });
}
