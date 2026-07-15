import {
  MODULE_REGISTRY,
} from '../../shared/modules/module.registry';

import type {
  WorkspaceMode,
} from '../../shared/modules/module.types';

import type {
  PageId,
} from './types';

const SESSION_STORAGE_KEYS = {
  activePage:
    'zerohub.ui.active-page.v1',
  favoriteIds:
    'zerohub.ui.favorites.v1',
  recentIds:
    'zerohub.ui.recents.v1',
  workspaceMode:
    'zerohub.ui.workspace-mode.v1',
} as const;

export type SessionSnapshot = {
  activePage: PageId;
  favoriteIds: PageId[];
  recentIds: PageId[];
  workspaceMode: WorkspaceMode;
};

export const DEFAULT_SESSION_SNAPSHOT:
  SessionSnapshot = {
    activePage: 'dashboard',
    favoriteIds: [],
    recentIds: [],
    workspaceMode: 'osint',
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
}

export function clearSessionSnapshot():
  void {
  Object.values(
    SESSION_STORAGE_KEYS,
  ).forEach((key) => {
    localStorage.removeItem(key);
  });
}
