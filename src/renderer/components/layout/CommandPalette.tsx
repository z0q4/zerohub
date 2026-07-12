import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  MODULE_REGISTRY,
} from '../../../shared/modules/module.registry';

import type {
  ModuleDefinition,
  ModuleSection,
} from '../../../shared/modules/module.types';

import type {
  PageId,
} from '../../app/types';

type CommandPaletteProps = {
  activePage: PageId;
  favoriteIds: PageId[];
  recentIds: PageId[];

  onClose(): void;

  onNavigate(
    page: PageId,
  ): void;

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

function scoreModule(
  module: ModuleDefinition,
  query: string,
): number {
  if (!query) {
    return 1;
  }

  const name =
    module.name.toLowerCase();
  const id =
    module.id.toLowerCase();
  const abbreviation =
    module.abbreviation
      .toLowerCase();
  const description =
    module.description
      .toLowerCase();

  if (name === query) {
    return 120;
  }

  if (name.startsWith(query)) {
    return 95;
  }

  if (abbreviation === query) {
    return 80;
  }

  if (id.startsWith(query)) {
    return 72;
  }

  if (name.includes(query)) {
    return 55;
  }

  if (description.includes(query)) {
    return 24;
  }

  return 0;
}

function isPinAllowed(
  id: PageId,
): boolean {
  return (
    id !== 'dashboard' &&
    id !== 'settings'
  );
}

export function CommandPalette({
  activePage,
  favoriteIds,
  recentIds,
  onClose,
  onNavigate,
  onToggleFavorite,
}: CommandPaletteProps) {
  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0);

  const normalizedQuery =
    query.trim().toLowerCase();

  const modules =
    useMemo(
      () =>
        MODULE_REGISTRY.map(
          (module) => {
            const favorite =
              favoriteIds.includes(
                module.id,
              );

            const recent =
              recentIds.includes(
                module.id,
              );

            const score =
              scoreModule(
                module,
                normalizedQuery,
              ) +
              (favorite
                ? 14
                : 0) +
              (recent
                ? 6
                : 0);

            return {
              module,
              favorite,
              recent,
              score,
            };
          },
        )
          .filter(
            (item) =>
              item.score > 0,
          )
          .sort(
            (left, right) =>
              right.score -
                left.score ||
              left.module.name.localeCompare(
                right.module.name,
              ),
          )
          .slice(0, 14),
      [
        favoriteIds,
        normalizedQuery,
        recentIds,
      ],
    );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (
      selectedIndex <
      modules.length
    ) {
      return;
    }

    setSelectedIndex(
      Math.max(
        0,
        modules.length - 1,
      ),
    );
  }, [
    modules.length,
    selectedIndex,
  ]);

  function activateSelected():
    void {
    const selected =
      modules[selectedIndex];

    if (!selected) {
      return;
    }

    onNavigate(
      selected.module.id,
    );
  }

  return (
    <div
      className="commandPaletteBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose();
        }
      }}
    >
      <section
        className="commandPalette commandPaletteV4"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <header className="commandPaletteSearch">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            ref={inputRef}
            value={query}
            type="search"
            placeholder="Buscar módulo, categoria ou função..."
            aria-label="Buscar módulo"
            onChange={(event) => {
              setQuery(
                event.target.value,
              );
            }}
            onKeyDown={(event) => {
              if (
                event.key ===
                'ArrowDown'
              ) {
                event.preventDefault();

                setSelectedIndex(
                  (current) =>
                    Math.min(
                      current + 1,
                      modules.length - 1,
                    ),
                );
              }

              if (
                event.key ===
                'ArrowUp'
              ) {
                event.preventDefault();

                setSelectedIndex(
                  (current) =>
                    Math.max(
                      0,
                      current - 1,
                    ),
                );
              }

              if (
                event.key ===
                'Enter'
              ) {
                event.preventDefault();
                activateSelected();
              }

              if (
                event.key ===
                'Escape'
              ) {
                onClose();
              }
            }}
          />

          <kbd>ESC</kbd>
        </header>

        <div className="commandPaletteBanner">
          <span>
            Use a palette para navegar
            rápido pelo ZeroHub.
          </span>

          <div>
            <small>
              {favoriteIds.length}
              {' '}
              favoritos
            </small>

            <small>
              {recentIds.length}
              {' '}
              recentes
            </small>
          </div>
        </div>

        <div className="commandPaletteResults">
          {modules.map(
            (
              item,
              index,
            ) => {
              const isSelected =
                selectedIndex ===
                index;

              const isActive =
                activePage ===
                item.module.id;

              return (
                <div
                  className={`commandPaletteItem ${
                    isSelected
                      ? 'selected'
                      : ''
                  }`}
                  key={item.module.id}
                  onMouseEnter={() => {
                    setSelectedIndex(
                      index,
                    );
                  }}
                >
                  <button
                    className="commandPaletteMain"
                    type="button"
                    onClick={() => {
                      onNavigate(
                        item.module.id,
                      );
                    }}
                  >
                    <span className="commandPaletteIcon">
                      {
                        item.module
                          .abbreviation
                      }
                    </span>

                    <span className="commandPaletteText">
                      <strong>
                        {
                          item.module
                            .name
                        }
                      </strong>

                      <small>
                        {
                          item.module
                            .description
                        }
                      </small>
                    </span>

                    <span className="commandPaletteMeta">
                      <em>
                        {
                          SECTION_LABELS[
                            item.module
                              .section
                          ]
                        }
                      </em>

                      {item.favorite && (
                        <i>
                          Favorite
                        </i>
                      )}

                      {item.recent && (
                        <i>
                          Recent
                        </i>
                      )}

                      {isActive && (
                        <i>
                          Active
                        </i>
                      )}
                    </span>
                  </button>

                  {isPinAllowed(
                    item.module.id,
                  ) && (
                    <button
                      className={`commandPaletteFavorite ${
                        item.favorite
                          ? 'active'
                          : ''
                      }`}
                      type="button"
                      aria-label={
                        item.favorite
                          ? 'Remover dos favoritos'
                          : 'Adicionar aos favoritos'
                      }
                      onClick={() => {
                        onToggleFavorite(
                          item.module.id,
                        );
                      }}
                    >
                      {item.favorite
                        ? '★'
                        : '☆'}
                    </button>
                  )}
                </div>
              );
            },
          )}

          {modules.length === 0 && (
            <div className="commandPaletteEmpty">
              Nenhum módulo encontrado.
            </div>
          )}
        </div>

        <footer className="commandPaletteFooter">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            navegar
          </span>

          <span>
            <kbd>↵</kbd>
            abrir
          </span>

          <span>
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
            buscar
          </span>

          <span>
            <kbd>☆</kbd>
            fixar
          </span>
        </footer>
      </section>
    </div>
  );
}

