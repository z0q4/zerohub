import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  getModulesByMode,
} from '../../../shared/modules/module.registry';

import {
  CompactModuleRail,
} from './CompactModuleRail';
import {
  ModuleWorkbenchDrawer,
} from './ModuleWorkbenchDrawer';
import {
  GoogleEmbedView,
} from './GoogleEmbedView';
import {
  MapProviderSelector,
} from './MapProviderSelector';
import {
  TopRightControls,
} from './TopRightControls';
import {
  WorldGlobeMap,
} from './WorldGlobeMap';
import {
  WorkspaceModeSwitcher,
} from './WorkspaceModeSwitcher';
import {
  WorkspaceErrorBoundary,
} from './WorkspaceErrorBoundary';
import {
  WorkspaceModulePanel,
} from './WorkspaceModulePanel';
import {
  WorkspaceSearch,
} from './WorkspaceSearch';

import type {
  InvestigationCase,
} from '../../../shared/cases/cases.types';
import type {
  MapProviderKeyStatus,
  MapProviderViewId,
} from '../../../shared/map-providers/map-providers.types';
import type {
  ModuleDefinition,
  WorkspaceMode,
} from '../../../shared/modules/module.types';
import type {
  PageId,
} from '../../app/types';
import type {
  MapWorkspaceViewState,
} from './map-workspace.types';
import type {
  GeographicTimelineEvent,
} from './geographic-timeline-activities';
import type {
  GeographicBoundingBox,
  GeographicSearchResult,
} from '../../../shared/geographic-search/geographic-search.types';
import type {
  UniversalMapCommand,
} from './universal-search.types';

type MapWorkspaceShellProps = {
  activeCase: InvestigationCase | null;
  activeModule: ModuleDefinition;
  activePage: PageId;
  children: ReactNode;
  commandHint: string;
  focusGeographicActivityId:
    string | null;
  geographicTimelineEvents:
    GeographicTimelineEvent[];
  geographicSearchResult:
    GeographicSearchResult | null;
  geographicSearchBusy: boolean;
  geographicSearchResultFavorite:
    boolean;
  modulePanelOpen: boolean;
  mode: WorkspaceMode;
  mapWorkspaceView:
    MapWorkspaceViewState;
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

  onModeChange(
    mode: WorkspaceMode,
  ): void;

  onModulePanelOpenChange(
    open: boolean,
  ): void;

  onNavigate(
    page: PageId,
  ): void;

  onOpenCommandPalette(): void;
};

function isDrawerPage(
  page: PageId,
): boolean {
  return page !== 'dashboard';
}

function getWorkspaceModules(
  mode: WorkspaceMode,
): ModuleDefinition[] {
  return getModulesByMode(mode).filter(
    (module) =>
      module.modes.includes(mode),
  );
}

export function MapWorkspaceShell({
  activeCase,
  activeModule,
  activePage,
  children,
  commandHint,
  focusGeographicActivityId,
  geographicSearchBusy,
  geographicSearchResult,
  geographicSearchResultFavorite,
  geographicTimelineEvents,
  modulePanelOpen,
  mode,
  mapWorkspaceView,
  onMapWorkspaceViewChange,
  onFocusGeographicActivityHandled,
  onOpenCaseActivity,
  onClearGeographicSearch,
  onMapViewportChange,
  onOpenIpRdap,
  onReverseGeographicSearch,
  onToggleGeographicFavorite,
  onModulePanelOpenChange,
  onModeChange,
  onNavigate,
  onOpenCommandPalette,
  universalMapCommand,
}: MapWorkspaceShellProps) {
  const [
    resetSignal,
    setResetSignal,
  ] = useState(0);
  const [
    cleanMapMode,
    setCleanMapMode,
  ] = useState(false);
  const [
    activeMapProviderView,
    setActiveMapProviderView,
  ] = useState<MapProviderViewId>(
    'openfreemap-globe',
  );
  const [
    googleKeyStatus,
    setGoogleKeyStatus,
  ] = useState<MapProviderKeyStatus | null>(
    null,
  );
  const [
    googleStatusBusy,
    setGoogleStatusBusy,
  ] = useState(true);
  const [
    cleanMapAnnouncement,
    setCleanMapAnnouncement,
  ] = useState<string | null>(null);
  const cleanMapModeRef =
    useRef(false);
  const cleanMapAnnouncementTimerRef =
    useRef<number | null>(null);
  const focusBeforeCleanMapRef =
    useRef<HTMLElement | null>(null);
  const shellRef =
    useRef<HTMLDivElement>(null);
  const modeNavigationRef =
    useRef<HTMLDivElement>(null);
  const modulesButtonRef =
    useRef<HTMLButtonElement>(null);
  const modulesForMode =
    useMemo(
      () =>
        getWorkspaceModules(mode),
      [mode],
    );

  useEffect(() => {
    let active = true;

    async function refreshGoogleStatus():
      Promise<void> {
      setGoogleStatusBusy(true);

      try {
        const status =
          await window.zeroHub
            .mapProviders
            .getGoogleKeyStatus();

        if (active) {
          setGoogleKeyStatus(status);
        }
      } catch {
        if (active) {
          setGoogleKeyStatus(null);
        }
      } finally {
        if (active) {
          setGoogleStatusBusy(false);
        }
      }
    }

    function handleStatusChange(): void {
      void refreshGoogleStatus();
    }

    void refreshGoogleStatus();
    window.addEventListener(
      'zerohub:map-provider-status-changed',
      handleStatusChange,
    );

    return () => {
      active = false;
      window.removeEventListener(
        'zerohub:map-provider-status-changed',
        handleStatusChange,
      );
    };
  }, []);
  useEffect(() => {
    if (
      !modulePanelOpen ||
      cleanMapMode
    ) {
      return;
    }

    function handlePointerDown(
      event: PointerEvent,
    ): void {
      if (event.target instanceof Node) {
        if (
          modeNavigationRef.current
            ?.contains(event.target) ||
          modulesButtonRef.current
            ?.contains(event.target)
        ) {
          return;
        }
      }

      onModulePanelOpenChange(false);
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      );
    };
  }, [
    cleanMapMode,
    modulePanelOpen,
    onModulePanelOpenChange,
  ]);

  useEffect(() => {
    function announce(
      message: string,
    ): void {
      if (
        cleanMapAnnouncementTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          cleanMapAnnouncementTimerRef
            .current,
        );
      }

      setCleanMapAnnouncement(message);
      cleanMapAnnouncementTimerRef.current =
        window.setTimeout(() => {
          cleanMapAnnouncementTimerRef.current =
            null;
          setCleanMapAnnouncement(null);
        }, 1_800);
    }

    function setCleanMode(
      active: boolean,
    ): void {
      if (
        cleanMapModeRef.current === active
      ) {
        return;
      }

      if (active) {
        const focused =
          document.activeElement;
        focusBeforeCleanMapRef.current =
          focused instanceof HTMLElement &&
          shellRef.current?.contains(focused)
            ? focused
            : null;
      }

      cleanMapModeRef.current = active;
      setCleanMapMode(active);
      announce(
        active
          ? 'MAPA LIMPO · SHIFT+F2 PARA RESTAURAR'
          : 'INTERFACE RESTAURADA',
      );

      window.requestAnimationFrame(() => {
        if (active) {
          shellRef.current
            ?.querySelector<HTMLElement>(
              '.maplibregl-canvas',
            )
            ?.focus({
              preventScroll: true,
            });
          return;
        }

        const previousFocus =
          focusBeforeCleanMapRef.current;
        focusBeforeCleanMapRef.current =
          null;

        if (
          previousFocus?.isConnected
        ) {
          previousFocus.focus({
            preventScroll: true,
          });
        }
      });
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      const protectedContent =
        shellRef.current?.closest<HTMLElement>(
          '.authProtectedContent',
        );

      if (protectedContent?.inert) {
        return;
      }

      const cleanMapShortcut =
        event.key === 'F2' &&
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;

      if (
        cleanMapShortcut &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCleanMode(
          !cleanMapModeRef.current,
        );
        return;
      }

      if (
        event.key === 'Escape' &&
        cleanMapModeRef.current
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCleanMode(false);
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
      true,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
        true,
      );

      if (
        cleanMapAnnouncementTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          cleanMapAnnouncementTimerRef
            .current,
        );
      }
    };
  }, []);

  const drawerOpen =
    isDrawerPage(activePage);

  return (
    <div
      className="mapWorkspaceShell"
      data-clean-map-mode={
        cleanMapMode
      }
      data-workspace-mode={mode}
      ref={shellRef}
    >
      <WorkspaceErrorBoundary>
        <div
          className="mapProviderHost"
          data-provider-view={
            activeMapProviderView
          }
        >
          <div
            className="mapProviderMapLibreView"
            aria-hidden={
              activeMapProviderView !==
              'openfreemap-globe'
            }
            inert={
              activeMapProviderView !==
              'openfreemap-globe'
            }
          >
            <WorldGlobeMap
              activeMode={mode}
              providerVisible={activeMapProviderView === 'openfreemap-globe'}
              focusGeographicActivityId={
                focusGeographicActivityId
              }
              geographicTimelineEvents={
                geographicTimelineEvents
              }
              cleanMapMode={cleanMapMode}
              geographicSearchResult={
                geographicSearchResult
              }
              geographicSearchBusy={
                geographicSearchBusy
              }
              geographicSearchResultFavorite={
                geographicSearchResultFavorite
              }
              mapWorkspaceView={
                mapWorkspaceView
              }
              markerCount={0}
              modulePanelOpen={
                modulePanelOpen
              }
              resetSignal={resetSignal}
              onMapWorkspaceViewChange={
                onMapWorkspaceViewChange
              }
              onFocusGeographicActivityHandled={
                onFocusGeographicActivityHandled
              }
              onOpenCaseActivity={
                onOpenCaseActivity
              }
              onClearGeographicSearch={
                onClearGeographicSearch
              }
              onMapViewportChange={
                onMapViewportChange
              }
              onOpenIpRdap={
                onOpenIpRdap
              }
              onReverseGeographicSearch={
                onReverseGeographicSearch
              }
              onToggleGeographicFavorite={
                onToggleGeographicFavorite
              }
              universalMapCommand={
                universalMapCommand
              }
            />
          </div>

          {activeMapProviderView !==
            'openfreemap-globe' && (
            <GoogleEmbedView
              configured={Boolean(
                googleKeyStatus
                  ?.configured,
              )}
              initialLatitude={
                mapWorkspaceView
                  .camera.latitude
              }
              initialLongitude={
                mapWorkspaceView
                  .camera.longitude
              }
              initialZoom={
                mapWorkspaceView
                  .camera.zoom
              }
              mode={
                activeMapProviderView ===
                'google-map-2d'
                  ? 'map-2d'
                  : 'street-360'
              }
              onConfigure={() => {
                onNavigate('settings');
              }}
              onReturnToMap={() => setActiveMapProviderView('openfreemap-globe')}
            />
          )}
        </div>
      </WorkspaceErrorBoundary>

      <header className="workspaceTopbar" aria-label="Controles do workspace">
        <strong className="workspaceTopbarBrand">ZEROHUB</strong>
        <MapProviderSelector
          activeView={
            activeMapProviderView
          }
          googleStatus={
            googleKeyStatus
          }
          statusBusy={
            googleStatusBusy
          }
          onConfigure={() => {
            onNavigate('settings');
          }}
          onSelect={
            setActiveMapProviderView
          }
        />

        <WorkspaceSearch
          commandHint={commandHint}
          mode={mode}
          onOpen={onOpenCommandPalette}
        />

        <TopRightControls
          activeCase={activeCase}
          modulePanelOpen={
            modulePanelOpen
          }
          modulesButtonRef={
            modulesButtonRef
          }
          onOpenCases={() => {
            onNavigate('cases');
          }}
          onToggleModulePanel={() => {
            onModulePanelOpenChange(
              !modulePanelOpen,
            );
          }}
          onOpenSettings={() => {
            onNavigate('settings');
          }}
          onRecenterMap={() => {
            setResetSignal(
              (current) =>
                current + 1,
            );
          }}
        />

        <WorkspaceModeSwitcher
          mode={mode}
          onChange={onModeChange}
        />
      </header>

      <CompactModuleRail
        activePage={activePage}
        modules={modulesForMode}
        onNavigate={onNavigate}
      />

      {drawerOpen && (
        <ModuleWorkbenchDrawer
          module={activeModule}
          onClose={() => {
            onNavigate('dashboard');
          }}
        >
          {children}
        </ModuleWorkbenchDrawer>
      )}

      <div
        className="workspaceModeNavigation"
        ref={modeNavigationRef}
      >
        {modulePanelOpen && (
          <WorkspaceModulePanel
            activePage={activePage}
            mode={mode}
            modules={modulesForMode}
            onClose={() => {
              onModulePanelOpenChange(
                false,
              );
            }}
            onNavigate={onNavigate}
          />
        )}
      </div>

      <footer className="workspaceStatusBar" aria-label="Estado do workspace cartográfico">
        <span>{mode.toUpperCase()}</span>
        <span>{activeCase ? `Case: ${activeCase.name}` : 'Sem case ativo'}</span>
        <span>Centro ZeroHub {mapWorkspaceView.camera.latitude.toFixed(4)}, {mapWorkspaceView.camera.longitude.toFixed(4)}</span>
        <span>{activeMapProviderView === 'openfreemap-globe' ? 'OpenFreeMap · Natural Earth' : 'Google Embed · câmera independente'}</span>
      </footer>

      {cleanMapAnnouncement && (
        <p
          className="cleanMapModeAnnouncement"
          role="status"
          aria-live="polite"
        >
          {cleanMapAnnouncement}
        </p>
      )}
    </div>
  );
}
