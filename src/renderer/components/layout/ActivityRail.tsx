import type {
  ModuleDefinition,
  ModuleSection,
} from '../../../shared/modules/module.types';

import type {
  PageId,
} from '../../app/types';

type ActivityRailProps = {
  activeModule:
    ModuleDefinition;

  favoriteModules:
    ModuleDefinition[];

  recentModules:
    ModuleDefinition[];

  isFavorite: boolean;

  onClose(): void;

  onNavigate(
    page: PageId,
  ): void;

  onOpenCommandPalette(): void;

  onToggleFavorite(
    page: PageId,
  ): void;
};

const SECTION_LABELS:
  Record<ModuleSection, string> = {
    workspace: 'Workspace',
    intelligence: 'Intelligence',
    analysis: 'Analysis',
    network: 'Network',
    'data-dev': 'Data & Dev',
    system: 'System',
  };

function RailModuleButton({
  module,
  onNavigate,
}: {
  module: ModuleDefinition;

  onNavigate(
    page: PageId,
  ): void;
}) {
  return (
    <button
      className="activityRailModule"
      type="button"
      title={
        module.description
      }
      onClick={() => {
        onNavigate(module.id);
      }}
    >
      <span>
        {module.abbreviation}
      </span>

      <div>
        <strong>
          {module.name}
        </strong>

        <small>
          {
            SECTION_LABELS[
              module.section
            ]
          }
        </small>
      </div>

      <i aria-hidden="true">
        →
      </i>
    </button>
  );
}

export function ActivityRail({
  activeModule,
  favoriteModules,
  recentModules,
  isFavorite,
  onClose,
  onNavigate,
  onOpenCommandPalette,
  onToggleFavorite,
}: ActivityRailProps) {
  const canFavorite =
    activeModule.id !==
      'dashboard' &&
    activeModule.id !==
      'settings';

  return (
    <aside className="activityRail">
      <header className="activityRailHeader">
        <div>
          <span>CONTEXT PANEL</span>

          <strong>
            Current Module
          </strong>
        </div>

        <button
          type="button"
          aria-label="Fechar painel"
          title="Fechar painel (Ctrl+J)"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <section className="activityRailCurrent">
        <div className="activityRailCurrentTop">
          <span className="activityRailCurrentIcon">
            {
              activeModule.abbreviation
            }
          </span>

          <span className="activityRailSection">
            {
              SECTION_LABELS[
                activeModule.section
              ]
            }
          </span>
        </div>

        <h2>
          {activeModule.name}
        </h2>

        <p>
          {activeModule.description}
        </p>

        <div className="activityRailCurrentMeta">
          <span>
            Status
          </span>

          <strong>
            {
              activeModule.status
            }
          </strong>
        </div>

        <div className="activityRailActions">
          <button
            className="primaryButton"
            type="button"
            onClick={
              onOpenCommandPalette
            }
          >
            Search Tools
          </button>

          {canFavorite && (
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                onToggleFavorite(
                  activeModule.id,
                );
              }}
            >
              {isFavorite
                ? 'Unpin'
                : 'Pin'}
            </button>
          )}
        </div>
      </section>

      <section className="activityRailSectionBlock">
        <header>
          <span>PINNED</span>

          <strong>
            {favoriteModules.length}
          </strong>
        </header>

        <div className="activityRailList">
          {favoriteModules.length >
          0 ? (
            favoriteModules
              .slice(0, 5)
              .map(
                (module) => (
                  <RailModuleButton
                    key={
                      module.id
                    }
                    module={module}
                    onNavigate={
                      onNavigate
                    }
                  />
                ),
              )
          ) : (
            <p>
              Fixe módulos para criar
              atalhos.
            </p>
          )}
        </div>
      </section>

      <section className="activityRailSectionBlock">
        <header>
          <span>RECENT</span>

          <strong>
            {recentModules.length}
          </strong>
        </header>

        <div className="activityRailList">
          {recentModules.length >
          0 ? (
            recentModules
              .slice(0, 5)
              .map(
                (module) => (
                  <RailModuleButton
                    key={
                      module.id
                    }
                    module={module}
                    onNavigate={
                      onNavigate
                    }
                  />
                ),
              )
          ) : (
            <p>
              Seu histórico aparece
              aqui.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}

