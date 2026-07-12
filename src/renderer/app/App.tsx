import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  IocIntelligencePage,
} from '../features/ioc-intelligence/pages/IocIntelligencePage';

import {
  DeveloperToolsPage,
} from '../features/developer-tools/pages/DeveloperToolsPage';

import {
  NetworkToolkitPage,
} from '../features/network-toolkit/pages/NetworkToolkitPage';

import {
  EmailSecurityPage,
} from '../features/email-security/pages/EmailSecurityPage';

import {
  WebReconPage,
} from '../features/web-recon/pages/WebReconPage';

import {
  CryptographyPage,
} from '../features/cryptography/pages/CryptographyPage';

import {
  SystemAuditPage,
} from '../features/system-audit/pages/SystemAuditPage';

import {
  LogAnalysisPage,
} from '../features/log-analysis/pages/LogAnalysisPage';

import {
  FileForensicsPage,
} from '../features/file-forensics/pages/FileForensicsPage';

import {
  ActivityRail,
} from '../components/layout/ActivityRail';

import {
  CommandPalette,
} from '../components/layout/CommandPalette';

import {
  Sidebar,
} from '../components/layout/Sidebar';

import {
  WorkspaceTabs,
} from '../components/layout/WorkspaceTabs';

import {
  EncodingPage,
} from '../features/encoding/pages/EncodingPage';

import {
  FileAnalysisPage,
} from '../features/file-analysis/pages/FileAnalysisPage';

import {
  NetworkPage,
} from '../features/network/pages/NetworkPage';

import {
  OsintPage,
} from '../features/osint/pages/OsintPage';

import {
  SettingsPage,
} from '../features/settings/pages/SettingsPage';

import {
  ThreatIntelligencePage,
} from '../features/threat-intelligence/pages/ThreatIntelligencePage';

import {
  SecretScannerPage,
} from '../features/secret-scanner/pages/SecretScannerPage';

import {
  UtilitiesPage,
} from '../features/utilities/pages/UtilitiesPage';

import {
  DashboardPage,
} from '../pages/DashboardPage';

import {
  MODULE_REGISTRY,
  getModuleById,
} from '../../shared/modules/module.registry';

import {
  DEFAULT_APP_SETTINGS,
} from '../../shared/settings/settings.defaults';

import type {
  AppSettings,
} from '../../shared/settings/settings.types';

import type {
  ModuleSection,
} from '../../shared/modules/module.types';

import type {
  PageId,
} from './types';

const SECTION_LABELS:
  Record<ModuleSection, string> = {
    workspace: 'Workspace',
    intelligence: 'Intelligence',
    analysis: 'Analysis',
    network: 'Network',
    'data-dev': 'Data & Dev',
    system: 'System',
  };

const FAVORITES_KEY =
  'zerohub.ui.favorites.v1';

const RECENTS_KEY =
  'zerohub.ui.recents.v1';

const SIDEBAR_KEY =
  'zerohub.ui.sidebar-collapsed.v1';

const TABS_KEY =
  'zerohub.ui.workspace-tabs.v1';

const RAIL_KEY =
  'zerohub.ui.activity-rail.v1';

const FOCUS_KEY =
  'zerohub.ui.focus-mode.v1';

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
      TABS_KEY,
    );

  const withoutDuplicates =
    Array.from(
      new Set<PageId>([
        'dashboard',
        ...stored,
      ]),
    );

  return withoutDuplicates.slice(
    0,
    9,
  );
}

export function App() {
  const [
    activePage,
    setActivePage,
  ] =
    useState<PageId>(
      'dashboard',
    );

  const [
    settings,
    setSettings,
  ] =
    useState<AppSettings>({
      ...DEFAULT_APP_SETTINGS,
    });

  const [
    commandPaletteOpen,
    setCommandPaletteOpen,
  ] = useState(false);

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] =
    useState<boolean>(
      () =>
        readBoolean(
          SIDEBAR_KEY,
          false,
        ),
    );

  const [
    activityRailOpen,
    setActivityRailOpen,
  ] =
    useState<boolean>(
      () =>
        readBoolean(
          RAIL_KEY,
          true,
        ),
    );

  const [
    focusMode,
    setFocusMode,
  ] =
    useState<boolean>(
      () =>
        readBoolean(
          FOCUS_KEY,
          false,
        ),
    );

  const [
    favoriteIds,
    setFavoriteIds,
  ] =
    useState<PageId[]>(
      () =>
        readStoredPages(
          FAVORITES_KEY,
        ),
    );

  const [
    recentIds,
    setRecentIds,
  ] =
    useState<PageId[]>(
      () =>
        readStoredPages(
          RECENTS_KEY,
        ),
    );

  const [
    openTabs,
    setOpenTabs,
  ] =
    useState<PageId[]>(
      readTabs,
    );

  const activeModule =
    getModuleById(activePage);

  const activeSection =
    SECTION_LABELS[
      activeModule.section
    ];

  const runtimeInfo =
    useMemo(
      () =>
        window.zeroHub
          .system
          .getRuntimeInfo(),
      [],
    );

  const commandHint =
    useMemo(
      () =>
        navigator.platform
          .toLowerCase()
          .includes('mac')
          ? '⌘ K'
          : 'Ctrl K',
      [],
    );

  const favoriteModules =
    useMemo(
      () =>
        favoriteIds
          .map((id) =>
            getModuleById(id),
          )
          .filter(
            (module) =>
              module.id !==
                'dashboard' &&
              module.id !==
                'settings',
          ),
      [favoriteIds],
    );

  const recentModules =
    useMemo(
      () =>
        recentIds
          .map((id) =>
            getModuleById(id),
          )
          .filter(
            (module) =>
              module.id !==
                'dashboard' &&
              module.id !==
                'settings',
          ),
      [recentIds],
    );

  useEffect(() => {
    let mounted = true;

    window.zeroHub.settings
      .get()
      .then(
        (
          loadedSettings,
        ) => {
          if (mounted) {
            setSettings(
              loadedSettings,
            );
          }
        },
      )
      .catch((error) => {
        console.error(
          'Não foi possível carregar as configurações.',
          error,
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document
      .documentElement
      .dataset
      .accent =
        settings.accentColor;

    document
      .documentElement
      .dataset
      .page =
        activePage;

    document
      .documentElement
      .dataset
      .section =
        activeModule.section;

    document
      .documentElement
      .classList
      .toggle(
        'compact-ui',
        settings.compactMode,
      );

    document
      .documentElement
      .classList
      .toggle(
        'sidebar-is-collapsed',
        sidebarCollapsed,
      );

    document
      .documentElement
      .classList
      .toggle(
        'activity-rail-open',
        activityRailOpen,
      );

    document
      .documentElement
      .classList
      .toggle(
        'focus-mode',
        focusMode,
      );
  }, [
    activeModule.section,
    activePage,
    activityRailOpen,
    focusMode,
    settings,
    sidebarCollapsed,
  ]);

  useEffect(() => {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(
        favoriteIds,
      ),
    );
  }, [favoriteIds]);

  useEffect(() => {
    localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(
        recentIds,
      ),
    );
  }, [recentIds]);

  useEffect(() => {
    localStorage.setItem(
      SIDEBAR_KEY,
      String(
        sidebarCollapsed,
      ),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      RAIL_KEY,
      String(
        activityRailOpen,
      ),
    );
  }, [activityRailOpen]);

  useEffect(() => {
    localStorage.setItem(
      FOCUS_KEY,
      String(
        focusMode,
      ),
    );
  }, [focusMode]);

  useEffect(() => {
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify(
        openTabs,
      ),
    );
  }, [openTabs]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      const modifier =
        event.ctrlKey ||
        event.metaKey;

      if (
        modifier &&
        event.key.toLowerCase() ===
          'k'
      ) {
        event.preventDefault();

        setCommandPaletteOpen(
          (current) =>
            !current,
        );
      }

      if (
        modifier &&
        event.key.toLowerCase() ===
          'b'
      ) {
        event.preventDefault();

        setSidebarCollapsed(
          (current) =>
            !current,
        );
      }

      if (
        modifier &&
        event.key.toLowerCase() ===
          'j'
      ) {
        event.preventDefault();

        setActivityRailOpen(
          (current) =>
            !current,
        );
      }

      if (
        modifier &&
        event.shiftKey &&
        event.key.toLowerCase() ===
          'f'
      ) {
        event.preventDefault();

        setFocusMode(
          (current) =>
            !current,
        );
      }

      if (
        event.altKey &&
        /^[1-9]$/.test(
          event.key,
        )
      ) {
        const index =
          Number(event.key) - 1;

        const target =
          openTabs[index];

        if (target) {
          event.preventDefault();
          navigate(target);
        }
      }

      if (
        event.key === 'Escape'
      ) {
        setCommandPaletteOpen(
          false,
        );
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [openTabs]);

  async function saveSettings(
    nextSettings:
      AppSettings,
  ): Promise<void> {
    const savedSettings =
      await window.zeroHub
        .settings
        .save(
          nextSettings,
        );

    setSettings(
      savedSettings,
    );
  }

  function ensureTab(
    page: PageId,
  ): void {
    setOpenTabs(
      (current) => {
        if (
          current.includes(page)
        ) {
          return current;
        }

        const next = [
          ...current,
          page,
        ];

        return next.slice(
          Math.max(
            0,
            next.length - 9,
          ),
        );
      },
    );
  }

  function navigate(
    page: PageId,
  ): void {
    setActivePage(page);
    setCommandPaletteOpen(false);
    ensureTab(page);

    if (
      page === 'dashboard' ||
      page === 'settings'
    ) {
      return;
    }

    setRecentIds(
      (current) => [
        page,
        ...current.filter(
          (id) =>
            id !== page,
        ),
      ].slice(0, 10),
    );
  }

  function closeTab(
    page: PageId,
  ): void {
    if (
      page === 'dashboard'
    ) {
      return;
    }

    setOpenTabs(
      (current) => {
        const index =
          current.indexOf(page);

        const next =
          current.filter(
            (item) =>
              item !== page,
          );

        if (
          activePage === page
        ) {
          const fallback =
            next[
              Math.max(
                0,
                index - 1,
              )
            ] ??
            'dashboard';

          setActivePage(
            fallback,
          );
        }

        return next;
      },
    );
  }

  function closeOtherTabs():
    void {
    setOpenTabs([
      'dashboard',
      ...(activePage ===
      'dashboard'
        ? []
        : [activePage]),
    ]);
  }

  function toggleFavorite(
    page: PageId,
  ): void {
    if (
      page === 'dashboard' ||
      page === 'settings'
    ) {
      return;
    }

    setFavoriteIds(
      (current) =>
        current.includes(page)
          ? current.filter(
              (id) =>
                id !== page,
            )
          : [
              page,
              ...current,
            ],
    );
  }

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            favoriteIds={
              favoriteIds
            }
            recentIds={
              recentIds
            }
            onNavigate={
              navigate
            }
            onOpenCommandPalette={() => {
              setCommandPaletteOpen(
                true,
              );
            }}
            onToggleFavorite={
              toggleFavorite
            }
          />
        );

      case 'ioc-intelligence':
        return <IocIntelligencePage />;

      case 'developer-tools':
        return <DeveloperToolsPage />;

      case 'network-toolkit':
        return <NetworkToolkitPage />;

      case 'email-security':
        return <EmailSecurityPage />;

      case 'web-recon':
        return <WebReconPage />;

      case 'cryptography':
        return <CryptographyPage />;

      case 'system-audit':
        return <SystemAuditPage />;

      case 'log-analysis':
        return <LogAnalysisPage />;

      case 'file-forensics':
        return <FileForensicsPage />;

      case 'file-analysis':
        return <FileAnalysisPage />;

      case 'network':
        return <NetworkPage />;

      case 'osint':
        return <OsintPage />;

      case 'encoding':
        return <EncodingPage />;

      case 'secret-scanner':
        return <SecretScannerPage />;

      case 'utilities':
        return <UtilitiesPage />;

      case 'threat-intelligence':
        return <ThreatIntelligencePage />;

      case 'settings':
        return (
          <SettingsPage
            settings={
              settings
            }
            onSave={
              saveSettings
            }
          />
        );
    }
  }

  return (
    <div
      className={`application applicationV5 ${
        sidebarCollapsed
          ? 'sidebarCollapsed'
          : ''
      } ${
        focusMode
          ? 'focusMode'
          : ''
      }`}
    >
      {!focusMode && (
        <Sidebar
          activePage={
            activePage
          }
          collapsed={
            sidebarCollapsed
          }
          favoriteIds={
            favoriteIds
          }
          recentIds={
            recentIds
          }
          showRuntimeInfo={
            settings
              .showRuntimeInfo
          }
          onNavigate={
            navigate
          }
          onOpenCommandPalette={() => {
            setCommandPaletteOpen(
              true,
            );
          }}
          onToggleCollapsed={() => {
            setSidebarCollapsed(
              (current) =>
                !current,
            );
          }}
          onToggleFavorite={
            toggleFavorite
          }
        />
      )}

      <section className="contentShell contentShellV5">
        <header className="appTopbar appTopbarV5">
          <div className="topbarLeft">
            {!focusMode && (
              <button
                className="topbarSidebarToggle"
                type="button"
                aria-label="Alternar sidebar"
                title="Alternar sidebar (Ctrl+B)"
                onClick={() => {
                  setSidebarCollapsed(
                    (current) =>
                      !current,
                  );
                }}
              >
                ☰
              </button>
            )}

            <div className="topbarContext">
              <span>
                {activeSection}
              </span>

              <strong>
                {activeModule.name}
              </strong>
            </div>
          </div>

          <div className="topbarCenter">
            <button
              className="topbarCommand"
              type="button"
              onClick={() => {
                setCommandPaletteOpen(
                  true,
                );
              }}
            >
              <span>
                ⌕
              </span>

              <strong>
                Buscar módulo
              </strong>

              <kbd>
                {commandHint}
              </kbd>
            </button>
          </div>

          <div className="topbarActions">
            <button
              className={`topbarUtilityButton ${
                activityRailOpen
                  ? 'active'
                  : ''
              }`}
              type="button"
              title="Painel contextual (Ctrl+J)"
              onClick={() => {
                setActivityRailOpen(
                  (current) =>
                    !current,
                );
              }}
            >
              Panel
            </button>

            <button
              className={`topbarUtilityButton ${
                focusMode
                  ? 'active'
                  : ''
              }`}
              type="button"
              title="Focus mode (Ctrl+Shift+F)"
              onClick={() => {
                setFocusMode(
                  (current) =>
                    !current,
                );
              }}
            >
              Focus
            </button>

            <button
              className="topbarSettings"
              type="button"
              aria-label="Abrir configurações"
              title="Configurações"
              onClick={() => {
                navigate(
                  'settings',
                );
              }}
            >
              ⚙
            </button>
          </div>
        </header>

        <div className="topbarSubbar topbarSubbarV5">
          <span>
            {activeModule.description}
          </span>

          <div>
            <small>
              {
                activeModule.abbreviation
              }
              {' · '}
              {activeSection}
            </small>

            {activePage !==
              'dashboard' &&
              activePage !==
                'settings' && (
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(
                    activePage,
                  );
                }}
              >
                {favoriteIds.includes(
                  activePage,
                )
                  ? 'Desafixar'
                  : 'Fixar'}
              </button>
            )}
          </div>
        </div>

        <WorkspaceTabs
          activePage={
            activePage
          }
          tabs={openTabs}
          onClose={
            closeTab
          }
          onCloseOthers={
            closeOtherTabs
          }
          onNavigate={
            navigate
          }
          onOpenCommandPalette={() => {
            setCommandPaletteOpen(
              true,
            );
          }}
        />

        <div
          className={`workspaceFrame ${
            activityRailOpen &&
            !focusMode
              ? 'withActivityRail'
              : ''
          }`}
        >
          <main className="mainContent workspaceMain">
            <div
              className="pageTransition"
              key={activePage}
            >
              {renderPage()}
            </div>
          </main>

          {activityRailOpen &&
            !focusMode && (
              <ActivityRail
                activeModule={
                  activeModule
                }
                favoriteModules={
                  favoriteModules
                }
                recentModules={
                  recentModules
                }
                isFavorite={
                  favoriteIds.includes(
                    activePage,
                  )
                }
                onClose={() => {
                  setActivityRailOpen(
                    false,
                  );
                }}
                onNavigate={
                  navigate
                }
                onOpenCommandPalette={() => {
                  setCommandPaletteOpen(
                    true,
                  );
                }}
                onToggleFavorite={
                  toggleFavorite
                }
              />
            )}
        </div>

        <footer className="statusBar">
          <div>
            <span className="statusBarPulse" />

            <strong>
              ZeroHub
            </strong>

            <span>
              {
                activeModule.status
              }
            </span>
          </div>

          <div>
            <span>
              {runtimeInfo.platform}
            </span>

            <span>
              Electron
              {' '}
              {
                runtimeInfo
                  .electronVersion
              }
            </span>

            <span>
              Node
              {' '}
              {
                runtimeInfo
                  .nodeVersion
              }
            </span>

            <span>
              Accent
              {' '}
              {
                settings.accentColor
              }
            </span>

            <span>
              Tabs
              {' '}
              {openTabs.length}
            </span>
          </div>
        </footer>
      </section>

      {commandPaletteOpen && (
        <CommandPalette
          activePage={
            activePage
          }
          favoriteIds={
            favoriteIds
          }
          recentIds={
            recentIds
          }
          onClose={() => {
            setCommandPaletteOpen(
              false,
            );
          }}
          onNavigate={
            navigate
          }
          onToggleFavorite={
            toggleFavorite
          }
        />
      )}
    </div>
  );
}
