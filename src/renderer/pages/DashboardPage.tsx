import {
  getDashboardModules,
  getModuleById,
  getOperationalModules,
} from '../../shared/modules/module.registry';

import type {
  ModuleDefinition,
  ModuleSection,
} from '../../shared/modules/module.types';

import type {
  PageId,
} from '../app/types';

type DashboardPageProps = {
  favoriteIds: PageId[];
  recentIds: PageId[];

  onNavigate(
    page: PageId,
  ): void;

  onOpenCommandPalette(): void;

  onToggleFavorite(
    page: PageId,
  ): void;
};

type DashboardGroup = {
  id: Exclude<
    ModuleSection,
    'workspace' | 'system'
  >;
  label: string;
  description: string;
};

const DASHBOARD_GROUPS:
  readonly DashboardGroup[] = [
    {
      id: 'intelligence',
      label: 'Intelligence',
      description:
        'Reconhecimento externo, reputação, IOC e OSINT.',
    },
    {
      id: 'analysis',
      label: 'Analysis',
      description:
        'Arquivos, segredos, logs, auditoria e investigação local.',
    },
    {
      id: 'network',
      label: 'Network',
      description:
        'Diagnóstico de conectividade e toolkit operacional.',
    },
    {
      id: 'data-dev',
      label: 'Data & Dev',
      description:
        'Encoding, criptografia e utilitários técnicos.',
    },
  ];

function resolveModules(
  ids: PageId[],
): ModuleDefinition[] {
  return ids
    .map((id) =>
      getModuleById(id),
    )
    .filter(
      (module) =>
        module.id !== 'dashboard' &&
        module.id !== 'settings',
    );
}

function modulesForSection(
  modules: ModuleDefinition[],
  section: DashboardGroup['id'],
): ModuleDefinition[] {
  return modules.filter(
    (module) =>
      module.section === section,
  );
}

export function DashboardPage({
  favoriteIds,
  recentIds,
  onNavigate,
  onOpenCommandPalette,
  onToggleFavorite,
}: DashboardPageProps) {
  const modules =
    getDashboardModules();
  const operationalModules =
    getOperationalModules();

  const favoriteModules =
    resolveModules(
      favoriteIds,
    ).slice(0, 6);

  const recentModules =
    resolveModules(
      recentIds,
    )
      .filter(
        (module) =>
          !favoriteIds.includes(
            module.id,
          ),
      )
      .slice(0, 5);

  const spotlightModule =
    favoriteModules[0] ??
    recentModules[0] ??
    operationalModules.find(
      (module) =>
        module.id !== 'dashboard' &&
        module.id !== 'settings',
    );

  const intelligenceCount =
    modules.filter(
      (module) =>
        module.section ===
        'intelligence',
    ).length;

  const analysisCount =
    modules.filter(
      (module) =>
        module.section ===
        'analysis',
    ).length;

  const networkCount =
    modules.filter(
      (module) =>
        module.section ===
        'network',
    ).length;

  const dataCount =
    modules.filter(
      (module) =>
        module.section ===
        'data-dev',
    ).length;

  return (
    <div className="dashboardPage dashboardPageV4">
      <section className="dashboardHero dashboardHeroV4">
        <div className="dashboardHeroContent">
          <span className="eyebrow">
            ZEROHUB · DESKTOP SECURITY WORKSPACE
          </span>

          <h1>
            Um cockpit técnico
            <br />
            para seu arsenal.
          </h1>

          <p>
            Centralize análise, rede,
            inteligência, criptografia e
            automação em um único software.
          </p>

          <div className="dashboardHeroActions">
            <button
              className="primaryButton"
              type="button"
              onClick={
                onOpenCommandPalette
              }
            >
              Abrir Command Palette
              <kbd>Ctrl K</kbd>
            </button>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                onNavigate(
                  'settings',
                );
              }}
            >
              Reconfigurar interface
            </button>
          </div>
        </div>

        <div className="dashboardHeroBoard">
          <div className="heroStatCard">
            <span>
              Operational Modules
            </span>
            <strong>
              {
                operationalModules.length
              }
            </strong>
          </div>

          <div className="heroStatCard">
            <span>
              Favorites
            </span>
            <strong>
              {favoriteIds.length}
            </strong>
          </div>

          <div className="heroStatCard">
            <span>Recent</span>
            <strong>
              {recentIds.length}
            </strong>
          </div>

          <div className="heroStatCard">
            <span>Status</span>
            <strong>Local</strong>
          </div>
        </div>
      </section>

      <section className="dashboardWorkbench">
        <div className="dashboardSpotlight">
          <header>
            <span>
              MODULE SPOTLIGHT
            </span>

            <h2>
              Comece pelo que importa
            </h2>
          </header>

          {spotlightModule && (
            <article className="spotlightCard">
              <div className="spotlightTop">
                <span className="spotlightIcon">
                  {
                    spotlightModule.abbreviation
                  }
                </span>

                <span className="spotlightBadge">
                  {
                    spotlightModule.section
                  }
                </span>
              </div>

              <div className="spotlightContent">
                <h3>
                  {spotlightModule.name}
                </h3>

                <p>
                  {
                    spotlightModule.description
                  }
                </p>
              </div>

              <div className="spotlightActions">
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => {
                    onNavigate(
                      spotlightModule.id,
                    );
                  }}
                >
                  Abrir módulo
                </button>

                {spotlightModule.id !==
                  'dashboard' &&
                  spotlightModule.id !==
                    'settings' && (
                  <button
                    className={`secondaryButton ${
                      favoriteIds.includes(
                        spotlightModule.id,
                      )
                        ? 'isActive'
                        : ''
                    }`}
                    type="button"
                    onClick={() => {
                      onToggleFavorite(
                        spotlightModule.id,
                      );
                    }}
                  >
                    {favoriteIds.includes(
                      spotlightModule.id,
                    )
                      ? 'Desafixar'
                      : 'Fixar'}
                  </button>
                )}
              </div>
            </article>
          )}
        </div>

        <div className="dashboardSidePanels">
          <section className="dashboardPanel">
            <header>
              <span>PINNED</span>
              <strong>
                Favorites
              </strong>
            </header>

            <div className="dashboardPanelList">
              {favoriteModules.length >
              0 ? (
                favoriteModules.map(
                  (module) => (
                    <button
                      className="dashboardMiniItem"
                      key={
                        module.id
                      }
                      type="button"
                      onClick={() => {
                        onNavigate(
                          module.id,
                        );
                      }}
                    >
                      <span>
                        {
                          module.abbreviation
                        }
                      </span>

                      <div>
                        <strong>
                          {
                            module.name
                          }
                        </strong>

                        <small>
                          {
                            module.section
                          }
                        </small>
                      </div>

                      <i>
                        ↗
                      </i>
                    </button>
                  ),
                )
              ) : (
                <div className="dashboardEmptyState">
                  Fixe módulos na
                  sidebar para criar
                  atalhos rápidos.
                </div>
              )}
            </div>
          </section>

          <section className="dashboardPanel">
            <header>
              <span>FLOW</span>
              <strong>
                Recent Modules
              </strong>
            </header>

            <div className="dashboardPanelList">
              {recentModules.length >
              0 ? (
                recentModules.map(
                  (module) => (
                    <button
                      className="dashboardMiniItem"
                      key={
                        module.id
                      }
                      type="button"
                      onClick={() => {
                        onNavigate(
                          module.id,
                        );
                      }}
                    >
                      <span>
                        {
                          module.icon
                        }
                      </span>

                      <div>
                        <strong>
                          {
                            module.name
                          }
                        </strong>

                        <small>
                          Último acesso
                        </small>
                      </div>

                      <i>
                        →
                      </i>
                    </button>
                  ),
                )
              ) : (
                <div className="dashboardEmptyState">
                  Os módulos
                  acessados aparecem
                  aqui.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="dashboardOverviewStrip">
        <article>
          <span>INTEL</span>
          <strong>
            {intelligenceCount}
          </strong>
        </article>

        <article>
          <span>ANALYSIS</span>
          <strong>
            {analysisCount}
          </strong>
        </article>

        <article>
          <span>NETWORK</span>
          <strong>
            {networkCount}
          </strong>
        </article>

        <article>
          <span>DATA & DEV</span>
          <strong>
            {dataCount}
          </strong>
        </article>
      </section>

      <div className="dashboardModuleGroups">
        {DASHBOARD_GROUPS.map(
          (group) => {
            const groupModules =
              modulesForSection(
                modules,
                group.id,
              );

            if (
              groupModules.length === 0
            ) {
              return null;
            }

            return (
              <section
                className="dashboardModuleGroup"
                data-section={group.id}
                key={group.id}
              >
                <header className="dashboardGroupHeader">
                  <div>
                    <span>
                      {group.label}
                    </span>

                    <h2>
                      {group.label}
                    </h2>

                    <p>
                      {group.description}
                    </p>
                  </div>

                  <strong>
                    {groupModules.length}
                    {' '}
                    módulos
                  </strong>
                </header>

                <div className="moduleGrid">
                  {groupModules.map(
                    (module) => {
                      const isFavorite =
                        favoriteIds.includes(
                          module.id,
                        );

                      return (
                        <article
                          className="moduleCard moduleAvailable"
                          key={module.id}
                        >
                          <button
                            className="moduleCardAction"
                            type="button"
                            onClick={() => {
                              onNavigate(
                                module.id,
                              );
                            }}
                          >
                            <div className="moduleTop">
                              <div className="moduleIcon">
                                {
                                  module.abbreviation
                                }
                              </div>

                              <span className="moduleStatus operational">
                                Ready
                              </span>
                            </div>

                            <div className="moduleContent">
                              <h3>
                                {module.name}
                              </h3>

                              <p>
                                {
                                  module.description
                                }
                              </p>
                            </div>

                            <div className="moduleCardFooter">
                              <span>
                                {module.icon}
                                {' '}
                                {group.label}
                              </span>

                              <strong
                                aria-hidden="true"
                              >
                                ↗
                              </strong>
                            </div>
                          </button>

                          {module.id !==
                            'dashboard' &&
                            module.id !==
                              'settings' && (
                            <button
                              className={`moduleFavoriteButton ${
                                isFavorite
                                  ? 'active'
                                  : ''
                              }`}
                              type="button"
                              aria-label={
                                isFavorite
                                  ? `Desafixar ${module.name}`
                                  : `Fixar ${module.name}`
                              }
                              onClick={() => {
                                onToggleFavorite(
                                  module.id,
                                );
                              }}
                            >
                              {isFavorite
                                ? '★'
                                : '☆'}
                            </button>
                          )}
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            );
          },
        )}
      </div>
    </div>
  );
}
