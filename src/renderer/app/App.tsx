import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CasesPage,
} from '../features/cases/pages/CasesPage';

import {
  useCaseWorkspace,
} from '../features/cases/CaseWorkspaceContext';


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
  CommandPalette,
} from '../components/layout/CommandPalette';

import {
  MapWorkspaceShell,
} from '../components/workspace/MapWorkspaceShell';
import {
  buildGeographicTimelineEvents,
} from '../components/workspace/map-marker-activities';

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
  MODULE_REGISTRY,
  getModuleById,
  isModuleAvailableInMode,
} from '../../shared/modules/module.registry';

import {
  DEFAULT_APP_SETTINGS,
} from '../../shared/settings/settings.defaults';

import type {
  AppSettings,
} from '../../shared/settings/settings.types';

import type {
  WorkspaceMode,
} from '../../shared/modules/module.types';

import type {
  MapWorkspaceViewState,
} from '../components/workspace/map-workspace.types';

import type {
  PageId,
} from './types';

import {
  DEFAULT_SESSION_SNAPSHOT,
  clearSessionSnapshot,
  readSessionSnapshot,
  saveSessionSnapshot,
} from './session-persistence';

import type {
  SessionSnapshot,
} from './session-persistence';
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

export function App() {
  const {
    activeCase,
    selectCase,
  } = useCaseWorkspace();

  const [
    activePage,
    setActivePage,
  ] =
    useState<PageId>(
      DEFAULT_SESSION_SNAPSHOT
        .activePage,
    );

  const [
    settings,
    setSettings,
  ] =
    useState<AppSettings>({
      ...DEFAULT_APP_SETTINGS,
    });

  const [
    sessionPersistenceReady,
    setSessionPersistenceReady,
  ] = useState(false);

  const [
    commandPaletteOpen,
    setCommandPaletteOpen,
  ] = useState(false);

  const [
    workspaceMode,
    setWorkspaceMode,
  ] =
    useState<WorkspaceMode>(
      DEFAULT_SESSION_SNAPSHOT
        .workspaceMode,
    );

  const [
    workspaceModulePanelOpen,
    setWorkspaceModulePanelOpen,
  ] =
    useState(false);

  const [
    mapWorkspaceView,
    setMapWorkspaceView,
  ] = useState<MapWorkspaceViewState>(
    DEFAULT_SESSION_SNAPSHOT
      .mapWorkspaceView,
  );

  const [
    focusedCaseActivityId,
    setFocusedCaseActivityId,
  ] = useState<string | null>(null);

  const [
    focusedMapActivityId,
    setFocusedMapActivityId,
  ] = useState<string | null>(null);

  const [
    favoriteIds,
    setFavoriteIds,
  ] =
    useState<PageId[]>(
      DEFAULT_SESSION_SNAPSHOT
        .favoriteIds,
    );

  const [
    recentIds,
    setRecentIds,
  ] =
    useState<PageId[]>(
      DEFAULT_SESSION_SNAPSHOT
        .recentIds,
    );

  const activeModule =
    getModuleById(activePage);
  const geographicTimelineEvents =
    useMemo(
      () =>
        activeCase
          ? buildGeographicTimelineEvents(
            activeCase.activities,
          )
          : [],
      [activeCase],
    );
  const geographicActivityIds =
    useMemo(
      () =>
        new Set(
          geographicTimelineEvents.map(
            (event) =>
              event.activityId,
          ),
        ),
      [geographicTimelineEvents],
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

  function applySessionSnapshot(
    snapshot: SessionSnapshot,
  ): void {
    setActivePage(
      isPageId(snapshot.activePage)
        ? snapshot.activePage
        : 'dashboard',
    );
    setFavoriteIds(
      snapshot.favoriteIds,
    );
    setRecentIds(
      snapshot.recentIds,
    );
    setWorkspaceMode(
      snapshot.workspaceMode,
    );
    setMapWorkspaceView(
      snapshot.mapWorkspaceView,
    );
  }
  useEffect(() => {
    let mounted = true;

    async function initializeSettings():
      Promise<void> {
      try {
        const loadedSettings =
          await window.zeroHub
            .settings
            .get();

        if (!mounted) {
          return;
        }

        setSettings(
          loadedSettings,
        );

        if (
          loadedSettings
            .saveSessionOnClose
        ) {
          applySessionSnapshot(
            readSessionSnapshot(),
          );
        } else {
          clearSessionSnapshot();
        }
      } catch (error) {
        console.error(
          'Não foi possível carregar as configurações.',
          error,
        );

        if (mounted) {
          applySessionSnapshot(
            readSessionSnapshot(),
          );
        }
      } finally {
        if (mounted) {
          setSessionPersistenceReady(
            true,
          );
        }
      }
    }

    void initializeSettings();

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
      .visualProfile =
        settings.visualProfile;

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
      .dataset
      .workspaceMode =
        workspaceMode;

    document
      .documentElement
      .classList
      .toggle(
        'compact-ui',
        settings.compactMode,
      );
  }, [
    activeModule.section,
    activePage,
    settings,
    workspaceMode,
  ]);

  useEffect(() => {
    if (
      !sessionPersistenceReady ||
      !settings
        .saveSessionOnClose
    ) {
      return;
    }

    saveSessionSnapshot({
      activePage,
      favoriteIds,
      recentIds,
      workspaceMode,
      mapWorkspaceView,
    });
  }, [
    activePage,
    favoriteIds,
    mapWorkspaceView,
    recentIds,
    sessionPersistenceReady,
    settings.saveSessionOnClose,
    workspaceMode,
  ]);

  useEffect(() => {
    if (
      isModuleAvailableInMode(
        activeModule,
        workspaceMode,
      )
    ) {
      return;
    }

    setActivePage('dashboard');
  }, [
    activeModule,
    workspaceMode,
  ]);

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
        event.key === '1'
      ) {
        event.preventDefault();

        setWorkspaceMode(
          'osint',
        );
      }

      if (
        modifier &&
        event.key === '2'
      ) {
        event.preventDefault();

        setWorkspaceMode(
          'attack',
        );
      }

      if (
        event.key === 'Escape'
      ) {
        if (workspaceModulePanelOpen) {
          setWorkspaceModulePanelOpen(
            false,
          );

          return;
        }

        if (commandPaletteOpen) {
          setCommandPaletteOpen(
            false,
          );

          return;
        }

        if (
          activePage !==
          'dashboard'
        ) {
          setActivePage(
            'dashboard',
          );
        }
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
  }, [
    activePage,
    commandPaletteOpen,
    workspaceModulePanelOpen,
  ]);

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

    if (
      !savedSettings
        .saveSessionOnClose
    ) {
      clearSessionSnapshot();

      await selectCase(null);
    }
  }

  const navigate = useCallback((
    page: PageId,
  ): void => {
    setActivePage(page);
    setCommandPaletteOpen(false);
    setWorkspaceModulePanelOpen(false);

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
  }, []);

  const clearFocusedCaseActivity =
    useCallback((): void => {
      setFocusedCaseActivityId(null);
    }, []);

  const openCaseActivity =
    useCallback(
      (activityId: string): void => {
        setFocusedCaseActivityId(
          activityId,
        );
        navigate('cases');
      },
      [navigate],
    );

  const clearFocusedMapActivity =
    useCallback((): void => {
      setFocusedMapActivityId(null);
    }, []);

  const viewCaseActivityOnMap =
    useCallback(
      (activityId: string): void => {
        setFocusedMapActivityId(
          activityId,
        );
        navigate('dashboard');
      },
      [navigate],
    );

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
      case 'cases':
        return (
          <CasesPage
            focusActivityId={
              focusedCaseActivityId
            }
            geographicActivityIds={
              geographicActivityIds
            }
            onFocusActivityHandled={
              clearFocusedCaseActivity
            }
            onViewActivityOnMap={
              viewCaseActivityOnMap
            }
          />
        );

      case 'dashboard':
        return null;

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
            onOpenCases={() => {
              navigate('cases');
            }}
            onSave={
              saveSettings
            }
          />
        );
    }
  }

  return (
    <>
      <MapWorkspaceShell
        activeCase={activeCase}
        activeModule={activeModule}
        activePage={activePage}
        commandHint={commandHint}
        modulePanelOpen={
          workspaceModulePanelOpen
        }
        mode={workspaceMode}
        mapWorkspaceView={
          mapWorkspaceView
        }
        focusGeographicActivityId={
          focusedMapActivityId
        }
        geographicTimelineEvents={
          geographicTimelineEvents
        }
        onMapWorkspaceViewChange={
          setMapWorkspaceView
        }
        onFocusGeographicActivityHandled={
          clearFocusedMapActivity
        }
        onModulePanelOpenChange={
          setWorkspaceModulePanelOpen
        }
        onOpenCaseActivity={
          openCaseActivity
        }
        onModeChange={setWorkspaceMode}
        onNavigate={navigate}
        onOpenCommandPalette={() => {
          setCommandPaletteOpen(
            true,
          );
        }}
      >
        <div
          className="pageTransition"
          key={activePage}
        >
          {renderPage()}
        </div>
      </MapWorkspaceShell>

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
          workspaceMode={
            workspaceMode
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
    </>
  );
}
