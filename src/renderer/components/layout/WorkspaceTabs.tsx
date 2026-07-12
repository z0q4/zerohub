import {
  getModuleById,
} from '../../../shared/modules/module.registry';

import type {
  PageId,
} from '../../app/types';

type WorkspaceTabsProps = {
  activePage: PageId;
  tabs: PageId[];

  onNavigate(
    page: PageId,
  ): void;

  onClose(
    page: PageId,
  ): void;

  onCloseOthers(): void;

  onOpenCommandPalette(): void;
};

export function WorkspaceTabs({
  activePage,
  tabs,
  onNavigate,
  onClose,
  onCloseOthers,
  onOpenCommandPalette,
}: WorkspaceTabsProps) {
  return (
    <div className="workspaceTabsBar">
      <div className="workspaceTabs">
        {tabs.map(
          (page) => {
            const module =
              getModuleById(page);

            const active =
              activePage === page;

            const pinned =
              page === 'dashboard';

            return (
              <div
                className={`workspaceTab ${
                  active
                    ? 'active'
                    : ''
                }`}
                key={page}
              >
                <button
                  className="workspaceTabMain"
                  type="button"
                  title={
                    module.description
                  }
                  onClick={() => {
                    onNavigate(page);
                  }}
                >
                  <span className="workspaceTabIcon">
                    {
                      module.abbreviation
                    }
                  </span>

                  <strong>
                    {module.name}
                  </strong>

                  {active && (
                    <i
                      aria-hidden="true"
                    />
                  )}
                </button>

                {!pinned && (
                  <button
                    className="workspaceTabClose"
                    type="button"
                    aria-label={`Fechar ${module.name}`}
                    title="Fechar aba"
                    onClick={() => {
                      onClose(page);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          },
        )}
      </div>

      <div className="workspaceTabsActions">
        <button
          type="button"
          title="Buscar módulo"
          onClick={
            onOpenCommandPalette
          }
        >
          ＋
        </button>

        <button
          type="button"
          title="Fechar outras abas"
          disabled={
            tabs.length <= 1
          }
          onClick={
            onCloseOthers
          }
        >
          ⋯
        </button>
      </div>
    </div>
  );
}

