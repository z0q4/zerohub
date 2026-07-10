import {
  useMemo,
} from 'react';

import {
  getModulesBySection,
} from '../../../shared/modules/module.registry';

import type {
  PageId,
} from '../../app/types';

type SidebarProps = {
  activePage: PageId;
  showRuntimeInfo: boolean;

  onNavigate(
    page: PageId,
  ): void;
};

export function Sidebar({
  activePage,
  showRuntimeInfo,
  onNavigate,
}: SidebarProps) {
  const runtimeInfo =
    useMemo(
      () =>
        window.zeroHub
          .system
          .getRuntimeInfo(),
      [],
    );

  const workspaceModules =
    getModulesBySection(
      'workspace',
    );

  const systemModules =
    getModulesBySection(
      'system',
    );

  function renderItems(
    modules:
      typeof workspaceModules,
  ) {
    return modules.map(
      (module) => {
        const isActive =
          activePage ===
          module.id;

        return (
          <button
            className={`navigationItem ${
              isActive
                ? 'active'
                : ''
            }`}
            key={module.id}
            type="button"
            aria-current={
              isActive
                ? 'page'
                : undefined
            }
            onClick={() =>
              onNavigate(
                module.id,
              )
            }
          >
            <span className="navigationIcon">
              {module.icon}
            </span>

            {module.name}

            {module.status ===
              'operational' &&
              module.id !==
                'dashboard' && (
                <span className="availableDot" />
              )}
          </button>
        );
      },
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandLogo">
          Z
        </div>

        <div className="brandText">
          <strong>ZeroHub</strong>

          <span>
            Desktop Platform
          </span>
        </div>
      </div>

      <span className="sectionLabel">
        WORKSPACE
      </span>

      <nav className="navigation">
        {renderItems(
          workspaceModules,
        )}
      </nav>

      <span className="sectionLabel systemLabel">
        SYSTEM
      </span>

      <nav className="navigation">
        {renderItems(
          systemModules,
        )}
      </nav>

      {showRuntimeInfo && (
        <div className="runtimeCard">
          <div className="runtimeStatus">
            <span className="statusIndicator" />
            Sistema operacional
          </div>

          <span>
            {runtimeInfo.platform}
          </span>

          <span>
            Electron{' '}
            {
              runtimeInfo
                .electronVersion
            }
          </span>

          <span>
            Node{' '}
            {
              runtimeInfo
                .nodeVersion
            }
          </span>
        </div>
      )}
    </aside>
  );
}
