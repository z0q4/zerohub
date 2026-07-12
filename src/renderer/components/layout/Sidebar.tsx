import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getModuleById,
  getModulesBySection,
} from '../../../shared/modules/module.registry';

import type {
  ModuleDefinition,
  ModuleSection,
} from '../../../shared/modules/module.types';

import type {
  PageId,
} from '../../app/types';

type SidebarProps = {
  activePage: PageId;
  collapsed: boolean;
  favoriteIds: PageId[];
  recentIds: PageId[];
  showRuntimeInfo: boolean;

  onNavigate(
    page: PageId,
  ): void;

  onToggleCollapsed(): void;

  onToggleFavorite(
    page: PageId,
  ): void;

  onOpenCommandPalette(): void;
};

type NavigationGroup = {
  id: ModuleSection;
  label: string;
  hint: string;
};

const NAVIGATION_GROUPS:
  readonly NavigationGroup[] = [
    {
      id: 'workspace',
      label: 'Workspace',
      hint: 'Home',
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      hint: 'Intel',
    },
    {
      id: 'analysis',
      label: 'Analysis',
      hint: 'Audit',
    },
    {
      id: 'network',
      label: 'Network',
      hint: 'Net',
    },
    {
      id: 'data-dev',
      label: 'Data & Dev',
      hint: 'Code',
    },
    {
      id: 'system',
      label: 'System',
      hint: 'Core',
    },
  ];

const INITIAL_OPEN_GROUPS:
  Record<ModuleSection, boolean> = {
    workspace: true,
    intelligence: true,
    analysis: true,
    network: true,
    'data-dev': true,
    system: true,
  };

function matchesQuery(
  module: ModuleDefinition,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    module.name,
    module.description,
    module.abbreviation,
    module.id,
    module.section,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function isPinAllowed(
  page: PageId,
): boolean {
  return (
    page !== 'dashboard' &&
    page !== 'settings'
  );
}

export function Sidebar({
  activePage,
  collapsed,
  favoriteIds,
  recentIds,
  showRuntimeInfo,
  onNavigate,
  onToggleCollapsed,
  onToggleFavorite,
  onOpenCommandPalette,
}: SidebarProps) {
  const runtimeInfo =
    useMemo(
      () =>
        window.zeroHub
          .system
          .getRuntimeInfo(),
      [],
    );

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    openGroups,
    setOpenGroups,
  ] =
    useState<
      Record<ModuleSection, boolean>
    >(INITIAL_OPEN_GROUPS);

  const normalizedQuery =
    query.trim().toLowerCase();

  const favoriteModules =
    useMemo(
      () =>
        favoriteIds
          .map((id) =>
            getModuleById(id),
          )
          .filter(
            (module) =>
              isPinAllowed(
                module.id,
              ) &&
              matchesQuery(
                module,
                normalizedQuery,
              ),
          ),
      [
        favoriteIds,
        normalizedQuery,
      ],
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
              isPinAllowed(
                module.id,
              ) &&
              !favoriteIds.includes(
                module.id,
              ) &&
              matchesQuery(
                module,
                normalizedQuery,
              ),
          )
          .slice(0, 4),
      [
        favoriteIds,
        normalizedQuery,
        recentIds,
      ],
    );

  const groupedModules =
    useMemo(
      () =>
        NAVIGATION_GROUPS
          .map((group) => ({
            ...group,
            modules:
              getModulesBySection(
                group.id,
              ).filter(
                (module) =>
                  matchesQuery(
                    module,
                    normalizedQuery,
                  ),
              ),
          }))
          .filter(
            (group) =>
              group.modules.length > 0,
          ),
      [normalizedQuery],
    );

  useEffect(() => {
    const containingGroup =
      NAVIGATION_GROUPS.find(
        (group) =>
          getModulesBySection(
            group.id,
          ).some(
            (module) =>
              module.id === activePage,
          ),
      );

    if (
      !containingGroup
    ) {
      return;
    }

    setOpenGroups(
      (current) => ({
        ...current,
        [containingGroup.id]:
          true,
      }),
    );
  }, [activePage]);

  function toggleGroup(
    section: ModuleSection,
  ): void {
    setOpenGroups(
      (current) => ({
        ...current,
        [section]:
          !current[section],
      }),
    );
  }

  function renderNavItem(
    module: ModuleDefinition,
  ) {
    const isActive =
      activePage === module.id;

    const isFavorite =
      favoriteIds.includes(
        module.id,
      );

    return (
      <div
        className="navigationItemRow"
        key={module.id}
      >
        <button
          className={`navigationItem ${
            isActive
              ? 'active'
              : ''
          }`}
          type="button"
          aria-current={
            isActive
              ? 'page'
              : undefined
          }
          title={
            collapsed
              ? module.name
              : module.description
          }
          onClick={() => {
            onNavigate(module.id);
          }}
        >
          <span className="navigationIcon">
            {module.icon}
          </span>

          <span className="navigationItemText">
            <strong>
              {module.name}
            </strong>

            <small>
              {
                module.description
              }
            </small>
          </span>

          {module.status ===
            'operational' && (
            <span
              className="availableDot"
              aria-hidden="true"
            />
          )}
        </button>

        {isPinAllowed(
          module.id,
        ) && (
          <button
            className={`navigationPin ${
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
            title={
              isFavorite
                ? 'Remover dos favoritos'
                : 'Adicionar aos favoritos'
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
      </div>
    );
  }

  return (
    <aside
      className={`sidebar sidebarV4 ${
        collapsed
          ? 'collapsed'
          : ''
      }`}
    >
      <div className="brand brandV4">
        <button
          className="brandLogo"
          type="button"
          title="Dashboard"
          onClick={() => {
            onNavigate(
              'dashboard',
            );
          }}
        >
          Z
        </button>

        <div className="brandText">
          <strong>ZeroHub</strong>

          <span>
            Security Platform
          </span>
        </div>

        <button
          className="sidebarCollapseButton"
          type="button"
          aria-label={
            collapsed
              ? 'Expandir sidebar'
              : 'Recolher sidebar'
          }
          title="Alternar sidebar (Ctrl+B)"
          onClick={
            onToggleCollapsed
          }
        >
          {collapsed
            ? '›'
            : '‹'}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebarMiniToolbar">
          <button
            type="button"
            onClick={() => {
              onNavigate(
                'dashboard',
              );
            }}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={
              onOpenCommandPalette
            }
          >
            Command
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate(
                'settings',
              );
            }}
          >
            Theme
          </button>
        </div>
      )}

      {collapsed ? (
        <button
          className="sidebarQuickButton"
          type="button"
          title="Buscar módulos (Ctrl+K)"
          onClick={
            onOpenCommandPalette
          }
        >
          ⌕
        </button>
      ) : (
        <div className="sidebarSearch">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            value={query}
            type="search"
            placeholder="Buscar módulo..."
            aria-label="Buscar módulo"
            onChange={(event) => {
              setQuery(
                event.target.value,
              );
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                groupedModules.length > 0 &&
                groupedModules[0]
                  .modules.length > 0
              ) {
                onNavigate(
                  groupedModules[0]
                    .modules[0].id,
                );
              }
            }}
          />

          {query && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => {
                setQuery('');
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {!collapsed && (
        <div className="sidebarHighlights">
          <div className="sidebarHighlightCard">
            <span>Favorites</span>
            <strong>
              {favoriteIds.length}
            </strong>
            <small>
              módulos fixados
            </small>
          </div>

          <div className="sidebarHighlightCard">
            <span>Recent</span>
            <strong>
              {recentIds.length}
            </strong>
            <small>
              acessos rápidos
            </small>
          </div>
        </div>
      )}

      <div className="sidebarNavigation">
        {!collapsed &&
          favoriteModules.length > 0 && (
            <section className="navigationGroup favoriteNavigationGroup">
              <div className="navigationGroupHeader static">
                <span className="navigationGroupMark">
                  ★
                </span>

                <span>
                  Favorites
                </span>

                <small>
                  {
                    favoriteModules.length
                  }
                </small>
              </div>

              <nav
                className="navigation"
                aria-label="Favorites"
              >
                {favoriteModules
                  .slice(0, 5)
                  .map(
                    renderNavItem,
                  )}
              </nav>
            </section>
          )}

        {!collapsed &&
          recentModules.length > 0 && (
            <section className="navigationGroup recentNavigationGroup">
              <div className="navigationGroupHeader static">
                <span className="navigationGroupMark">
                  ↺
                </span>

                <span>
                  Recent
                </span>

                <small>
                  {
                    recentModules.length
                  }
                </small>
              </div>

              <nav
                className="navigation"
                aria-label="Recent"
              >
                {recentModules.map(
                  renderNavItem,
                )}
              </nav>
            </section>
          )}

        {groupedModules.map(
          (group) => {
            const isOpen =
              collapsed ||
              normalizedQuery.length >
                0 ||
              openGroups[group.id];

            return (
              <section
                className="navigationGroup"
                key={group.id}
              >
                <button
                  className="navigationGroupHeader"
                  type="button"
                  title={
                    collapsed
                      ? group.label
                      : undefined
                  }
                  aria-expanded={isOpen}
                  onClick={() => {
                    if (!collapsed) {
                      toggleGroup(
                        group.id,
                      );
                    }
                  }}
                >
                  <span className="navigationGroupMark">
                    {group.hint.slice(
                      0,
                      1,
                    )}
                  </span>

                  <span>
                    {group.label}
                  </span>

                  <small>
                    {group.modules.length}
                  </small>

                  <span
                    className={`navigationChevron ${
                      isOpen
                        ? 'open'
                        : ''
                    }`}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>

                {isOpen && (
                  <nav
                    className="navigation"
                    aria-label={
                      group.label
                    }
                  >
                    {group.modules.map(
                      renderNavItem,
                    )}
                  </nav>
                )}
              </section>
            );
          },
        )}

        {groupedModules.length === 0 && (
          <div className="sidebarEmpty">
            Nenhum módulo encontrado.
          </div>
        )}
      </div>

      <div className="sidebarFooter">
        {!collapsed && (
          <div className="sidebarFooterDock">
            <button
              type="button"
              onClick={
                onOpenCommandPalette
              }
            >
              Ctrl+K
            </button>

            <button
              type="button"
              onClick={() => {
                onNavigate(
                  'settings',
                );
              }}
            >
              Settings
            </button>
          </div>
        )}

        {showRuntimeInfo && (
          <div
            className="runtimeCard"
            title={
              collapsed
                ? `${runtimeInfo.platform} · Electron ${runtimeInfo.electronVersion}`
                : undefined
            }
          >
            <div className="runtimeStatus">
              <span className="statusIndicator" />

              <strong>
                Runtime local
              </strong>
            </div>

            <div>
              <span>OS</span>
              <strong>
                {runtimeInfo.platform}
              </strong>
            </div>

            <div>
              <span>Electron</span>
              <strong>
                {
                  runtimeInfo
                    .electronVersion
                }
              </strong>
            </div>

            <div>
              <span>Node</span>
              <strong>
                {
                  runtimeInfo
                    .nodeVersion
                }
              </strong>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
