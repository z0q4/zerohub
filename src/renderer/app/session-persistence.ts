import {
  MODULE_REGISTRY,
} from '../../shared/modules/module.registry';

import type {
  PageId,
} from './types';

const SESSION_STORAGE_KEYS = {
  activityRailOpen:
    'zerohub.ui.activity-rail.v1',
  focusMode:
    'zerohub.ui.focus-mode.v1',
  openTabs:
    'zerohub.ui.workspace-tabs.v1',
  recentIds:
    'zerohub.ui.recents.v1',
  sidebarCollapsed:
    'zerohub.ui.sidebar-collapsed.v1',
} as const;

export type SessionSnapshot = {
  activityRailOpen: boolean;
  focusMode: boolean;
  openTabs: PageId[];
  recentIds: PageId[];
  sidebarCollapsed: boolean;
};

export const DEFAULT_SESSION_SNAPSHOT:
  SessionSnapshot = {
    activityRailOpen: true,
    focusMode: false,
    openTabs: ['dashboard'],
    recentIds: [],
    sidebarCollapsed: false,
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

function readBoolean(
  key: string,
  fallback: boolean,
): boolean {
  const value =
    localStorage.getItem(key);

  if (value === null) {
    return fallback;
  }

  return value === 'true';
}

function readTabs(): PageId[] {
  const stored =
    readStoredPages(
      SESSION_STORAGE_KEYS
        .openTabs,
    );

  return Array.from(
    new Set<PageId>([
      'dashboard',
      ...stored,
    ]),
  ).slice(0, 9);
}

export function readSessionSnapshot():
  SessionSnapshot {
  return {
    activityRailOpen:
      readBoolean(
        SESSION_STORAGE_KEYS
          .activityRailOpen,
        DEFAULT_SESSION_SNAPSHOT
          .activityRailOpen,
      ),
    focusMode:
      readBoolean(
        SESSION_STORAGE_KEYS
          .focusMode,
        DEFAULT_SESSION_SNAPSHOT
          .focusMode,
      ),
    openTabs: readTabs(),
    recentIds:
      readStoredPages(
        SESSION_STORAGE_KEYS
          .recentIds,
      ),
    sidebarCollapsed:
      readBoolean(
        SESSION_STORAGE_KEYS
          .sidebarCollapsed,
        DEFAULT_SESSION_SNAPSHOT
          .sidebarCollapsed,
      ),
  };
}

export function saveSessionSnapshot(
  snapshot: SessionSnapshot,
): void {
  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .activityRailOpen,
    String(
      snapshot.activityRailOpen,
    ),
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .focusMode,
    String(snapshot.focusMode),
  );

  localStorage.setItem(
    SESSION_STORAGE_KEYS
      .openTabs,
    JSON.stringify(
      snapshot.openTabs,
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
      .sidebarCollapsed,
    String(
      snapshot.sidebarCollapsed,
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
