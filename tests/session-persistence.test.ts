import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAP_WORKSPACE_DEFAULT_SCOPE,
  readSessionSnapshot,
  saveSessionSnapshot,
} from '../src/renderer/app/session-persistence';
import {
  DEFAULT_MAP_WORKSPACE_VIEW_STATE,
} from '../src/renderer/components/workspace/map-workspace.types';

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [
        ...values.keys(),
      ][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function installStorage(): Storage {
  const storage = createStorage();

  Object.defineProperty(
    globalThis,
    'localStorage',
    {
      configurable: true,
      value: storage,
    },
  );

  return storage;
}

test(
  'migra o estado global antigo para o escopo padrão',
  () => {
    const storage = installStorage();
    storage.setItem(
      'zerohub.ui.map-workspace-view.v1',
      JSON.stringify({
        hiddenMarkerCategories: [
          'Incidente',
        ],
        markerColorFilter: 'cyan',
        monochromeMode: true,
      }),
    );

    const view = readSessionSnapshot()
      .mapWorkspaceViews[
        MAP_WORKSPACE_DEFAULT_SCOPE
      ];

    assert.deepEqual(
      view.hiddenMarkerCategories,
      ['Incidente'],
    );
    assert.equal(
      view.markerColorFilter,
      'cyan',
    );
    assert.equal(
      view.monochromeMode,
      true,
    );
    assert.equal(
      view.basemapStyle,
      'tactical',
    );
    assert.deepEqual(
      view.camera,
      DEFAULT_MAP_WORKSPACE_VIEW_STATE
        .camera,
    );
  },
);

test(
  'preserva snapshots independentes por case',
  () => {
    installStorage();
    const first = {
      ...DEFAULT_MAP_WORKSPACE_VIEW_STATE,
      camera: {
        bearing: 15,
        latitude: -8.05,
        longitude: -34.88,
        pitch: 20,
        zoom: 11,
      },
    };
    const second = {
      ...DEFAULT_MAP_WORKSPACE_VIEW_STATE,
      camera: {
        bearing: -30,
        latitude: 40.71,
        longitude: -74,
        pitch: 0,
        zoom: 8,
      },
      monochromeMode: true,
      basemapStyle: 'streets-light' as const,
    };

    saveSessionSnapshot({
      activePage: 'dashboard',
      favoriteIds: [],
      recentIds: [],
      workspaceMode: 'osint',
      mapWorkspaceViews: {
        [MAP_WORKSPACE_DEFAULT_SCOPE]: {
          ...DEFAULT_MAP_WORKSPACE_VIEW_STATE,
        },
        'case-one': first,
        'case-two': second,
      },
    });

    const views = readSessionSnapshot()
      .mapWorkspaceViews;

    assert.deepEqual(
      views['case-one'].camera,
      first.camera,
    );
    assert.deepEqual(
      views['case-two'].camera,
      second.camera,
    );
    assert.equal(
      views['case-two'].monochromeMode,
      false,
    );
    assert.equal(
      views['case-two'].basemapStyle,
      'streets-light',
    );
  },
);

test(
  'ignora preset cartográfico desconhecido',
  () => {
    const storage = installStorage();
    storage.setItem(
      'zerohub.ui.map-workspace-view.v1',
      JSON.stringify({
        basemapStyle: 'satellite-hostile',
        monochromeMode: false,
      }),
    );

    const view = readSessionSnapshot()
      .mapWorkspaceViews[
        MAP_WORKSPACE_DEFAULT_SCOPE
      ];

    assert.equal(
      view.basemapStyle,
      'streets-dark',
    );
    assert.equal(
      view.monochromeMode,
      false,
    );
  },
);

test(
  'normaliza câmera hostil e ignora escopos perigosos',
  () => {
    const storage = installStorage();
    storage.setItem(
      'zerohub.ui.map-workspace-view.v1',
      '{"version":2,"views":{"__proto__":{"monochromeMode":true},"safe":{"camera":{"bearing":null,"latitude":999,"longitude":null,"pitch":-1,"zoom":200},"hiddenOperationalLayers":["measurements","unknown"]}}}',
    );

    const views = readSessionSnapshot()
      .mapWorkspaceViews;

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        views,
        '__proto__',
      ),
      false,
    );
    assert.deepEqual(
      views.safe.camera,
      DEFAULT_MAP_WORKSPACE_VIEW_STATE
        .camera,
    );
    assert.deepEqual(
      views.safe.hiddenOperationalLayers,
      ['measurements'],
    );
  },
);
