import {
  useEffect,
  useRef,
} from 'react';

import type {
  ModuleDefinition,
  WorkspaceMode,
} from '../../../shared/modules/module.types';

import type {
  PageId,
} from '../../app/types';

type WorkspaceModulePanelProps = {
  activePage: PageId;
  mode: WorkspaceMode;
  modules: ModuleDefinition[];

  onClose(): void;

  onNavigate(
    page: PageId,
  ): void;
};

export function WorkspaceModulePanel({
  activePage,
  mode,
  modules,
  onClose,
  onNavigate,
}: WorkspaceModulePanelProps) {
  const modeLabel =
    mode === 'osint'
      ? 'OSINT'
      : 'ATTACK';
  const headingId =
    `workspace-module-panel-heading-${mode}`;
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    return () => {
      const trigger =
        document.getElementById(
          'workspace-modules-trigger',
        );

      if (
        trigger instanceof
        HTMLButtonElement
      ) {
        trigger.focus();
      }
    };
  }, []);

  return (
    <aside
      className="workspaceModulePanel"
      id="workspace-module-panel"
      aria-labelledby={headingId}
      data-mode={mode}
    >
      <header className="workspaceModulePanelHeader">
        <div>
          <span>
            Modo {modeLabel}
          </span>

          <h2 id={headingId}>
            Módulos
          </h2>

          <p>
            {modules.length}
            {' '}
            {modules.length === 1
              ? 'módulo registrado'
              : 'módulos registrados'}
          </p>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label={`Fechar módulos ${modeLabel}`}
          title="Fechar painel"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {modules.length > 0 ? (
        <nav
          className="workspaceModulePanelList"
          aria-label={`Módulos ${modeLabel}`}
        >
          {modules.map((module) => {
            const isActive =
              activePage ===
              module.id;

            return (
              <button
                className={`workspaceModulePanelItem ${
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
                onClick={() => {
                  onNavigate(
                    module.id,
                  );
                }}
              >
                <span
                  className="workspaceModulePanelIcon"
                  aria-hidden="true"
                >
                  {module.abbreviation}
                </span>

                <span className="workspaceModulePanelText">
                  <strong>
                    {module.name}
                  </strong>

                  <small>
                    {module.description}
                  </small>
                </span>

                <span
                  className="workspaceModulePanelArrow"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            );
          })}
        </nav>
      ) : (
        <div
          className="workspaceModulePanelEmpty"
          role="status"
        >
          <strong>
            Nenhum módulo disponível
          </strong>

          <p>
            Não há módulos reais registrados
            para o modo {modeLabel}.
          </p>
        </div>
      )}
    </aside>
  );
}
