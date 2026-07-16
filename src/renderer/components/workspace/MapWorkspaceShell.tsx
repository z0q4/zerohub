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
  TopRightControls,
} from './TopRightControls';
import {
  WorldGlobeMap,
} from './WorldGlobeMap';
import {
  WorkspaceModeSwitcher,
} from './WorkspaceModeSwitcher';
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
} from './map-marker-activities';

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
  modulePanelOpen: boolean;
  mode: WorkspaceMode;
  mapWorkspaceView:
    MapWorkspaceViewState;

  onMapWorkspaceViewChange(
    viewState: SetStateAction<
      MapWorkspaceViewState
    >,
  ): void;

  onFocusGeographicActivityHandled(): void;

  onOpenCaseActivity(
    activityId: string,
  ): void;

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
  geographicTimelineEvents,
  modulePanelOpen,
  mode,
  mapWorkspaceView,
  onMapWorkspaceViewChange,
  onFocusGeographicActivityHandled,
  onOpenCaseActivity,
  onModulePanelOpenChange,
  onModeChange,
  onNavigate,
  onOpenCommandPalette,
}: MapWorkspaceShellProps) {
  const [
    resetSignal,
    setResetSignal,
  ] = useState(0);
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
    if (!modulePanelOpen) {
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
    modulePanelOpen,
    onModulePanelOpenChange,
  ]);

  const activeModeLabel =
    mode === 'osint'
      ? 'OSINT'
      : 'ATTACK';
  const drawerOpen =
    isDrawerPage(activePage);

  return (
    <div
      className="mapWorkspaceShell"
      data-workspace-mode={mode}
    >
      <WorldGlobeMap
        activeMode={mode}
        focusGeographicActivityId={
          focusGeographicActivityId
        }
        geographicTimelineEvents={
          geographicTimelineEvents
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
      />

      <CompactModuleRail
        activePage={activePage}
        modules={modulesForMode}
        onNavigate={onNavigate}
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

      {!drawerOpen && (
        <section className="workspaceHomeOverlay">
          <span>
            ZEROHUB ·{' '}
            {activeModeLabel}
          </span>

          <h1>ZeroHub</h1>

          <p>
            {modulesForMode.length}
            {' '}
            módulos disponíveis.
            {' '}
            {activeCase
              ? `Case ativo: ${activeCase.name}.`
              : 'Nenhum case ativo.'}
          </p>

          <small>
            Use a busca ou a rail
            lateral para abrir uma
            ferramenta.
          </small>
        </section>
      )}

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

        <WorkspaceModeSwitcher
          mode={mode}
          onChange={onModeChange}
        />
      </div>
    </div>
  );
}
