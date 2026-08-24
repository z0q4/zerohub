import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  MODULE_REGISTRY,
  isModuleAvailableInMode,
} from '../../../shared/modules/module.registry';
import {
  createCoordinateResult,
} from '../workspace/useUniversalSearch';

import type {
  GeographicSearchResult,
} from '../../../shared/geographic-search/geographic-search.types';
import type {
  ModuleDefinition,
  ModuleSection,
  WorkspaceMode,
} from '../../../shared/modules/module.types';
import type {
  PageId,
} from '../../app/types';
import type {
  UniversalSearchState,
} from '../workspace/useUniversalSearch';

type UniversalCommand =
  | 'open-ip'
  | 'toggle-monochrome'
  | 'clear-search'
  | 'show-markers'
  | 'copy-center'
  | 'mark-center'
  | 'clear-transient';

type CommandPaletteProps = {
  activePage: PageId;
  favoriteIds: PageId[];
  recentIds: PageId[];
  search: UniversalSearchState;
  workspaceMode: WorkspaceMode;

  onClose(): void;
  onDomain(domain: string): void;
  onExecuteCommand(
    command: UniversalCommand,
  ): void;
  onGeographicResult(
    result: GeographicSearchResult,
  ): void;
  onIp(ip: string): void;
  onNavigate(page: PageId): void;
  onToggleFavorite(page: PageId): void;
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

const TYPE_LABELS = {
  address: 'Endereço',
  street: 'Via',
  neighbourhood: 'Bairro',
  city: 'Cidade',
  region: 'Região',
  country: 'País',
  poi: 'Ponto de interesse',
  coordinate: 'Coordenada',
  unknown: 'Local',
} as const;

const UNIVERSAL_COMMANDS: Array<{
  id: UniversalCommand;
  aliases: string[];
  label: string;
  description: string;
}> = [
  {
    id: 'open-ip',
    aliases: [
      'abrir ip',
      'ip',
      'ip intelligence',
    ],
    label: 'Abrir IP Intelligence',
    description:
      'Abre o painel de geolocalização por IP.',
  },
  {
    id: 'toggle-monochrome',
    aliases: [
      'alternar p/b',
      'p/b',
      'monocromático',
    ],
    label: 'Alternar preto e branco',
    description:
      'Alterna o estilo cartográfico atual.',
  },
  {
    id: 'show-markers',
    aliases: [
      'mostrar marcadores',
      'marcadores',
    ],
    label: 'Mostrar marcadores',
    description:
      'Restaura a visibilidade das camadas operacionais.',
  },
  {
    id: 'clear-search',
    aliases: [
      'limpar pesquisa',
      'limpar busca',
    ],
    label: 'Limpar pesquisa',
    description:
      'Remove o resultado geográfico transitório.',
  },
  {
    id: 'copy-center',
    aliases: [
      'copiar centro',
      'copiar coordenada central',
    ],
    label: 'Copiar coordenada do centro',
    description:
      'Copia a coordenada atualmente centralizada no mapa.',
  },
  {
    id: 'mark-center',
    aliases: [
      'marcar centro',
      'criar marcador no centro',
    ],
    label: 'Criar marcador no centro',
    description:
      'Cria um marcador transitório no centro atual.',
  },
  {
    id: 'clear-transient',
    aliases: [
      'limpar transitórios',
      'limpar resultados transitórios',
    ],
    label: 'Limpar resultados transitórios',
    description:
      'Remove apenas marcadores e pesquisa não persistidos.',
  },
];

function scoreModule(
  module: ModuleDefinition,
  query: string,
): number {
  if (!query) {
    return 1;
  }

  const name = module.name.toLowerCase();
  const id = module.id.toLowerCase();
  const abbreviation =
    module.abbreviation.toLowerCase();
  const description =
    module.description.toLowerCase();

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

function isPinAllowed(id: PageId): boolean {
  return id !== 'dashboard' && id !== 'settings';
}

function highlightMatch(
  text: string,
  normalizedQuery: string,
): ReactNode {
  if (!normalizedQuery) {
    return text;
  }

  const start = text
    .toLocaleLowerCase('pt-BR')
    .indexOf(normalizedQuery);

  if (start < 0) {
    return text;
  }

  const end = start + normalizedQuery.length;

  return (
    <>
      {text.slice(0, start)}
      <mark className="universalSearchMatch">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function CommandPalette({
  activePage,
  favoriteIds,
  recentIds,
  search,
  workspaceMode,
  onClose,
  onDomain,
  onExecuteCommand,
  onGeographicResult,
  onIp,
  onNavigate,
  onToggleFavorite,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousFocusRef =
    useRef<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] =
    useState(0);
  const normalizedQuery = search.query
    .trim()
    .toLocaleLowerCase('pt-BR');
  const modules = useMemo(
    () => MODULE_REGISTRY.map((module) => {
      const favorite = favoriteIds.includes(module.id);
      const recent = recentIds.includes(module.id);
      const baseScore = scoreModule(
        module,
        normalizedQuery,
      );
      const score = baseScore > 0
        ? baseScore +
          (favorite ? 14 : 0) +
          (recent ? 6 : 0)
        : 0;

      return {
        module,
        favorite,
        recent,
        score,
      };
    })
      .filter((item) => isModuleAvailableInMode(
        item.module,
        workspaceMode,
      ))
      .filter((item) => item.score > 0)
      .sort((left, right) =>
        right.score - left.score ||
        left.module.name.localeCompare(right.module.name),
      )
      .slice(0, normalizedQuery ? 5 : 8),
    [favoriteIds, normalizedQuery, recentIds, workspaceMode],
  );
  const commands = useMemo(() => {
    if (search.classification.kind !== 'command') {
      return [];
    }

    const commandQuery = search.classification.value;
    return UNIVERSAL_COMMANDS.filter((command) =>
      command.aliases.some((alias) =>
        alias.includes(commandQuery),
      ),
    );
  }, [search.classification]);
  const showModules =
    search.classification.kind === 'empty' ||
    search.classification.kind === 'geographic';
  const specialCount =
    search.classification.kind === 'ip' ||
    search.classification.kind === 'domain' ||
    search.classification.kind === 'coordinate'
      ? 1
      : 0;
  const moduleCount = showModules ? modules.length : 0;
  const commandCount = commands.length;
  const geographicCount =
    search.classification.kind === 'geographic'
      ? search.suggestions.length
      : 0;
  const totalSelectable = specialCount + commandCount +
    moduleCount + geographicCount;

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    inputRef.current?.focus();

    return () => {
      const previous = previousFocusRef.current;

      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    setSelectedIndex((current) => Math.max(
      0,
      Math.min(current, totalSelectable - 1),
    ));
  }, [totalSelectable]);

  useEffect(() => {
    const selected = resultsRef.current
      ?.querySelector<HTMLElement>(
        `#universal-option-${selectedIndex}`,
      );

    selected?.scrollIntoView({
      block: 'nearest',
    });
  }, [selectedIndex]);

  function handleDialogKeyDown(
    event: KeyboardEvent<HTMLElement>,
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      search.cancel();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) =>
      element.getClientRects().length > 0,
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      return;
    }

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function activateSelected(): void {
    const classification = search.classification;

    if (specialCount === 1) {
      if (classification.kind === 'ip') {
        onIp(classification.value);
      } else if (classification.kind === 'domain') {
        onDomain(classification.value);
      } else if (classification.kind === 'coordinate') {
        const result = createCoordinateResult(
          classification.latitude,
          classification.longitude,
        );
        search.selectResult(result);
        onGeographicResult(result);
      }
      return;
    }

    if (selectedIndex < commandCount) {
      const command = commands[selectedIndex];
      if (command) {
        onExecuteCommand(command.id);
      }
      return;
    }

    const moduleIndex = selectedIndex - commandCount;
    if (moduleIndex < moduleCount) {
      const selected = modules[moduleIndex];
      if (selected) {
        onNavigate(selected.module.id);
      }
      return;
    }

    const result = search.suggestions[
      moduleIndex - moduleCount
    ];
    if (result) {
      search.selectResult(result);
      onGeographicResult(result);
    }
  }

  function selectGeographicResult(
    result: GeographicSearchResult,
  ): void {
    search.selectResult(result);
    onGeographicResult(result);
  }

  return (
    <div
      className="commandPaletteBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="commandPalette commandPaletteV4 universalSearchPalette"
        role="dialog"
        aria-modal="true"
        aria-label="Busca universal"
        onKeyDown={handleDialogKeyDown}
      >
        <header className="commandPaletteSearch">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={search.query}
            type="search"
            role="combobox"
            placeholder="Ferramenta, comando, IP, domínio, coordenada ou lugar…"
            aria-label="Busca universal"
            aria-controls="universal-search-results"
            aria-expanded={totalSelectable > 0}
            aria-activedescendant={
              totalSelectable > 0
                ? `universal-option-${selectedIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-busy={search.busy}
            aria-describedby="universal-search-context universal-search-feedback"
            onChange={(event) => {
              search.setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(
                  current + 1,
                  Math.max(0, totalSelectable - 1),
                ));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(0, current - 1));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                activateSelected();
              }
            }}
          />
          <kbd>ESC</kbd>
        </header>

        <div
          className="commandPaletteBanner"
          id="universal-search-context"
        >
          <span>
            Busca local primeiro. Lugares usam Photon/OpenStreetMap após 3 caracteres.
          </span>
          <div>
            <small>
              {favoriteIds.length + search.favorites.length} favoritos
            </small>
            <small>
              {recentIds.length + search.history.length} recentes
            </small>
            <small
              className={
                search.networkOnline
                  ? 'online'
                  : 'offline'
              }
            >
              {search.networkOnline
                ? 'Online'
                : 'Offline'}
            </small>
          </div>
        </div>

        {search.classification.kind === 'geographic' && (
          <div className="universalSearchFilters">
            <label>
              <span>Tipo</span>
              <select
                value={search.filter}
                aria-label="Filtrar tipo de lugar"
                onChange={(event) => {
                  search.setFilter(
                    event.target.value as UniversalSearchState['filter'],
                  );
                }}
              >
                <option value="all">Todos</option>
                <option value="address">Endereços</option>
                <option value="street">Vias</option>
                <option value="neighbourhood">Bairros</option>
                <option value="city">Cidades</option>
                <option value="poi">Pontos de interesse</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={search.restrictToViewport}
                onChange={(event) => {
                  search.setRestrictToViewport(event.target.checked);
                }}
              />
              Pesquisar nesta área
            </label>
            {search.busy && (
              <button type="button" onClick={search.cancel}>
                Cancelar
              </button>
            )}
          </div>
        )}

        <div
          ref={resultsRef}
          className="commandPaletteResults"
          id="universal-search-results"
          role="listbox"
          aria-label="Resultados da busca universal"
        >
          {specialCount === 1 && (
            <button
              id="universal-option-0"
              className={`commandPaletteMain universalSearchSpecial ${
                selectedIndex === 0 ? 'selected' : ''
              }`}
              type="button"
              role="option"
              aria-selected={selectedIndex === 0}
              onMouseEnter={() => { setSelectedIndex(0); }}
              onClick={activateSelected}
            >
              <span className="commandPaletteIcon">
                {search.classification.kind === 'ip'
                  ? 'IP'
                  : search.classification.kind === 'domain'
                    ? 'RD'
                    : '⌖'}
              </span>
              <span className="commandPaletteText">
                <strong>
                  {search.classification.kind === 'ip'
                    ? 'Consultar no IP Intelligence'
                    : search.classification.kind === 'domain'
                      ? 'Abrir consulta RDAP'
                      : 'Ir para a coordenada'}
                </strong>
                <small>
                  {search.classification.kind === 'ip' &&
                    !search.classification.public
                    ? 'O IP será validado e faixas privadas não serão consultadas.'
                    : 'Entrada reconhecida localmente; nenhuma busca geográfica será enviada.'}
                </small>
              </span>
            </button>
          )}

          {commands.map((command, index) => (
            <button
              id={`universal-option-${index}`}
              className={`commandPaletteMain universalSearchSpecial ${
                selectedIndex === index ? 'selected' : ''
              }`}
              key={command.id}
              type="button"
              role="option"
              aria-selected={selectedIndex === index}
              onMouseEnter={() => { setSelectedIndex(index); }}
              onClick={() => { onExecuteCommand(command.id); }}
            >
              <span className="commandPaletteIcon">&gt;</span>
              <span className="commandPaletteText">
                <strong>{command.label}</strong>
                <small>{command.description}</small>
              </span>
            </button>
          ))}

          {showModules && modules.map((item, index) => {
            const optionIndex = commandCount + index;
            const isSelected = selectedIndex === optionIndex;
            const isActive = activePage === item.module.id;

            return (
              <div
                className={`commandPaletteItem ${isSelected ? 'selected' : ''}`}
                key={item.module.id}
                onMouseEnter={() => { setSelectedIndex(optionIndex); }}
              >
                <button
                  id={`universal-option-${optionIndex}`}
                  className="commandPaletteMain"
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onNavigate(item.module.id); }}
                >
                  <span className="commandPaletteIcon">
                    {item.module.abbreviation}
                  </span>
                  <span className="commandPaletteText">
                    <strong>{item.module.name}</strong>
                    <small>{item.module.description}</small>
                  </span>
                  <span className="commandPaletteMeta">
                    <em>{SECTION_LABELS[item.module.section]}</em>
                    {item.favorite && <i>Favorite</i>}
                    {item.recent && <i>Recent</i>}
                    {isActive && <i>Active</i>}
                  </span>
                </button>
                {isPinAllowed(item.module.id) && (
                  <button
                    className={`commandPaletteFavorite ${item.favorite ? 'active' : ''}`}
                    type="button"
                    aria-label={
                      item.favorite
                        ? 'Remover dos favoritos'
                        : 'Adicionar aos favoritos'
                    }
                    onClick={() => { onToggleFavorite(item.module.id); }}
                  >
                    {item.favorite ? '★' : '☆'}
                  </button>
                )}
              </div>
            );
          })}

          {search.classification.kind === 'geographic' &&
            search.suggestions.map((result, index) => {
              const optionIndex = commandCount + moduleCount + index;
              const selected = selectedIndex === optionIndex;

              return (
                <div
                  className={`commandPaletteItem universalSearchPlace ${selected ? 'selected' : ''}`}
                  key={result.id}
                  onMouseEnter={() => { setSelectedIndex(optionIndex); }}
                >
                  <button
                    id={`universal-option-${optionIndex}`}
                    className="commandPaletteMain"
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { selectGeographicResult(result); }}
                  >
                    <span className="commandPaletteIcon">⌖</span>
                    <span className="commandPaletteText">
                      <strong>
                        {highlightMatch(
                          result.name,
                          normalizedQuery,
                        )}
                      </strong>
                      <small>
                        {highlightMatch(
                          result.label,
                          normalizedQuery,
                        )}
                      </small>
                    </span>
                    <span className="commandPaletteMeta">
                      <em>{TYPE_LABELS[result.type]}</em>
                      {result.cached && <i>Cache</i>}
                    </span>
                  </button>
                  <button
                    className={`commandPaletteFavorite ${search.isFavorite(result.id) ? 'active' : ''}`}
                    type="button"
                    aria-label={
                      search.isFavorite(result.id)
                        ? 'Remover local dos favoritos'
                        : 'Adicionar local aos favoritos'
                    }
                    onClick={() => { search.toggleFavorite(result); }}
                  >
                    {search.isFavorite(result.id) ? '★' : '☆'}
                  </button>
                </div>
              );
            })}

          {totalSelectable === 0 && !search.busy && (
            <div className="commandPaletteEmpty">
              {search.classification.kind === 'invalid'
                ? search.classification.message
                : 'Nenhum resultado encontrado.'}
            </div>
          )}
        </div>

        {search.feedback && (
          <p
            id="universal-search-feedback"
            className={`universalSearchFeedback ${search.feedback.tone}`}
            role={search.feedback.tone === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {search.feedback.message}
            {search.feedback.tone === 'error' && (
              <button type="button" onClick={search.retry}>
                Tentar novamente
              </button>
            )}
          </p>
        )}

        {!normalizedQuery &&
          (search.favorites.length > 0 || search.history.length > 0) && (
          <section className="universalSearchStored">
            {search.favorites.length > 0 && (
              <div>
                <strong>Locais favoritos</strong>
                {search.favorites.slice(0, 3).map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => { selectGeographicResult(result); }}
                  >
                    {result.name}
                  </button>
                ))}
              </div>
            )}
            {search.history.length > 0 && (
              <div>
                <strong>Locais recentes</strong>
                {search.history.slice(0, 3).map((item) => (
                  <span key={item.id}>
                    <button
                      type="button"
                      onClick={() => { selectGeographicResult(item.result); }}
                    >
                      {item.result.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover ${item.result.name} do histórico`}
                      onClick={() => { search.removeHistory(item.id); }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="commandPaletteFooter">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <label>
            <input
              type="checkbox"
              checked={search.historyEnabled}
              onChange={(event) => {
                search.setHistoryEnabled(event.target.checked);
              }}
            />
            histórico local
          </label>
          {search.history.length > 0 && (
            <button type="button" onClick={search.clearHistory}>
              Limpar histórico
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void search.clearCache();
            }}
          >
            Limpar cache
          </button>
        </footer>
      </section>
    </div>
  );
}

export type { UniversalCommand };
