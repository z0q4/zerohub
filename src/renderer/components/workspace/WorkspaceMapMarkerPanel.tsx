import {
  useEffect,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
} from './map-workspace.types';

import type {
  CoordinateParseResult,
  GeographicMarker,
  MapMarkerCategory,
  MapMarkerDetailsUpdate,
  MapMarkerFeedback,
  MapMarkerSource,
  RecentMapLocation,
} from './map-workspace.types';

type MarkerUpdate =
  Partial<MapMarkerDetailsUpdate>;

type WorkspaceMapMarkerPanelProps = {
  activeCaseName: string | null;
  caseBusy: boolean;
  coordinateInput: string;
  copiedTarget: string | null;
  editorFeedback: MapMarkerFeedback | null;
  locatorFeedback: MapMarkerFeedback | null;
  panelOpen: boolean;
  recentLocations: RecentMapLocation[];
  savingMarker: boolean;
  selectedMarker: GeographicMarker | null;

  onCenterMarker(
    marker: GeographicMarker,
  ): void;

  onCenterRecent(
    location: RecentMapLocation,
  ): void;

  onClearInput(): void;

  onCoordinateInputChange(
    value: string,
  ): void;

  onCopyInput(): void;

  onCopyMarker(
    marker: GeographicMarker,
  ): void;

  onCopyRecent(
    location: RecentMapLocation,
  ): void;

  onLocate(): void;

  onRemoveMarker(
    markerId: string,
  ): void;

  onReuseRecent(
    location: RecentMapLocation,
  ): void;

  onSaveMarker(): void;

  onUpdateMarker(
    markerId: string,
    update: MarkerUpdate,
  ): void;
};

const DECIMAL_COORDINATE_PATTERN =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

const TIME_FORMATTER =
  new Intl.DateTimeFormat(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );

export function formatCoordinates(
  latitude: number,
  longitude: number,
): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function parseCoordinateInput(
  input: string,
): CoordinateParseResult {
  const normalized =
    input.trim().replace(/\s+/g, ' ');
  const commaCount =
    normalized.match(/,/g)?.length ?? 0;
  const parts =
    commaCount > 0
      ? commaCount === 1
        ? normalized
          .split(',')
          .map((part) => part.trim())
        : []
      : normalized.split(' ');

  if (
    parts.length !== 2 ||
    parts.some(
      (part) =>
        !DECIMAL_COORDINATE_PATTERN
          .test(part),
    )
  ) {
    return {
      error:
        'Informe latitude e longitude em números decimais.',
    };
  }

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return {
      error:
        'Informe latitude e longitude em números decimais.',
    };
  }

  if (
    latitude < -90 ||
    latitude > 90
  ) {
    return {
      error:
        'A latitude deve estar entre -90 e 90.',
    };
  }

  if (
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      error:
        'A longitude deve estar entre -180 e 180.',
    };
  }

  return {
    coordinate: [
      longitude,
      latitude,
    ],
    latitude,
    longitude,
  };
}

function formatTime(
  createdAt: string,
): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return TIME_FORMATTER.format(date);
}

function sourceLabel(
  source: MapMarkerSource,
): string {
  switch (source) {
    case 'captured':
      return 'Capturada';
    case 'typed':
      return 'Digitada';
    case 'saved':
      return 'Salva';
  }
}

export function WorkspaceMapMarkerPanel({
  activeCaseName,
  caseBusy,
  coordinateInput,
  copiedTarget,
  editorFeedback,
  locatorFeedback,
  panelOpen,
  recentLocations,
  savingMarker,
  selectedMarker,
  onCenterMarker,
  onCenterRecent,
  onClearInput,
  onCoordinateInputChange,
  onCopyInput,
  onCopyMarker,
  onCopyRecent,
  onLocate,
  onRemoveMarker,
  onReuseRecent,
  onSaveMarker,
  onUpdateMarker,
}: WorkspaceMapMarkerPanelProps) {
  const [
    confirmingRemovalId,
    setConfirmingRemovalId,
  ] = useState<string | null>(null);

  useEffect(() => {
    setConfirmingRemovalId(null);
  }, [selectedMarker?.id]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();
    onLocate();
  }

  return (
    <section
      className="workspaceMapMarkerPanel"
      id="workspace-coordinate-panel"
      aria-label="Marcadores geográficos"
      hidden={!panelOpen}
    >
      <form
        className="coordinateLocator"
        aria-label="Localizar coordenadas"
        onSubmit={handleSubmit}
      >
        <input
          value={coordinateInput}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="-8.0476, -34.8770"
          aria-label="Latitude e longitude"
          aria-invalid={
            locatorFeedback?.tone ===
            'error'
          }
          aria-describedby={
            locatorFeedback
              ? 'coordinate-locator-feedback'
              : undefined
          }
          onChange={(event) => {
            onCoordinateInputChange(
              event.target.value,
            );
          }}
        />

        <div className="coordinateLocatorActions">
          <button
            type="submit"
            aria-label="Localizar coordenada"
          >
            Localizar
          </button>

          <button
            type="button"
            aria-label="Copiar coordenada do campo"
            onClick={onCopyInput}
          >
            {copiedTarget === 'main'
              ? 'Copiado'
              : 'Copiar'}
          </button>

          <button
            type="button"
            aria-label="Limpar campo de coordenadas"
            onClick={onClearInput}
          >
            Limpar
          </button>
        </div>

        {locatorFeedback && (
          <small
            className={
              locatorFeedback.tone
            }
            id="coordinate-locator-feedback"
            role="status"
          >
            {locatorFeedback.message}
          </small>
        )}
      </form>

      {selectedMarker ? (
        <form
          className="mapMarkerEditor"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveMarker();
          }}
        >
          <header>
            <div>
              <span>MARCADOR</span>
              <strong>
                {selectedMarker.saved
                  ? 'Salvo no perfil'
                  : 'Transitório'}
              </strong>
            </div>

            <small>
              {formatCoordinates(
                selectedMarker.latitude,
                selectedMarker.longitude,
              )}
            </small>
          </header>

          <label>
            <span>Nome</span>
            <input
              value={selectedMarker.name}
              type="text"
              maxLength={120}
              disabled={selectedMarker.saved}
              aria-label="Nome do marcador"
              onChange={(event) => {
                onUpdateMarker(
                  selectedMarker.id,
                  {
                    name:
                      event.target.value,
                  },
                );
              }}
            />
          </label>

          <label>
            <span>Categoria</span>
            <select
              value={
                selectedMarker.category
              }
              disabled={selectedMarker.saved}
              aria-label="Categoria do marcador"
              onChange={(event) => {
                onUpdateMarker(
                  selectedMarker.id,
                  {
                    category:
                      event.target.value as MapMarkerCategory,
                  },
                );
              }}
            >
              {MAP_MARKER_CATEGORIES.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ),
              )}
            </select>
          </label>

          <fieldset
            className="mapMarkerColorPicker"
            disabled={selectedMarker.saved}
          >
            <legend>Cor</legend>

            <div>
              {MAP_MARKER_COLORS.map(
                (color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={color.label}
                    aria-pressed={
                      selectedMarker.color ===
                      color.id
                    }
                    title={color.label}
                    style={{
                      '--marker-color':
                        color.value,
                    } as React.CSSProperties}
                    onClick={() => {
                      onUpdateMarker(
                        selectedMarker.id,
                        {
                          color: color.id,
                        },
                      );
                    }}
                  />
                ),
              )}
            </div>
          </fieldset>

          <div className="mapMarkerEditorActions">
            <button
              type="button"
              onClick={() => {
                onCenterMarker(
                  selectedMarker,
                );
              }}
            >
              Centralizar
            </button>

            <button
              type="button"
              onClick={() => {
                onCopyMarker(
                  selectedMarker,
                );
              }}
            >
              {copiedTarget ===
              `marker:${selectedMarker.id}`
                ? 'Copiado'
                : 'Copiar'}
            </button>

            {!selectedMarker.saved && (
              <button
                type="button"
                onClick={() => {
                  setConfirmingRemovalId(
                    selectedMarker.id,
                  );
                }}
              >
                Remover
              </button>
            )}
          </div>

          {confirmingRemovalId ===
            selectedMarker.id && (
            <section className="mapMarkerPanelRemoveConfirmation">
              <p>
                Este marcador transitório será
                removido somente da sessão atual.
                O perfil e a timeline não serão
                alterados.
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingRemovalId(
                      null,
                    );
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onRemoveMarker(
                      selectedMarker.id,
                    );
                    setConfirmingRemovalId(
                      null,
                    );
                  }}
                >
                  Confirmar remoção
                </button>
              </div>
            </section>
          )}

          {!selectedMarker.saved && (
            <button
              className="saveMapMarkerButton"
              type="submit"
              disabled={
                caseBusy ||
                savingMarker
              }
            >
              {savingMarker
                ? 'Salvando...'
                : 'Salvar no perfil'}
            </button>
          )}

          <p className="mapMarkerCaseHint">
            {activeCaseName
              ? `Perfil ativo: ${activeCaseName}`
              : 'Nenhum perfil ativo.'}
          </p>

          {editorFeedback && (
            <small
              className={
                editorFeedback.tone
              }
              role="status"
            >
              {editorFeedback.message}
            </small>
          )}
        </form>
      ) : (
        <p className="mapMarkerEditorHint">
          Use CTRL + clique esquerdo no globo
          ou localize uma coordenada para criar
          um marcador.
        </p>
      )}

      <section className="recentMapLocations">
        <header>
          <strong>Recentes</strong>
          <span>
            {recentLocations.length}/20
          </span>
        </header>

        {recentLocations.length > 0 ? (
          <div className="recentMapLocationList">
            {recentLocations.map(
              (location) => (
                <article key={location.id}>
                  <div>
                    <strong>
                      {location.name}
                    </strong>
                    <small>
                      {sourceLabel(
                        location.source,
                      )}
                      {' · '}
                      {formatTime(
                        location.createdAt,
                      )}
                    </small>
                    <code>
                      {formatCoordinates(
                        location.latitude,
                        location.longitude,
                      )}
                    </code>
                  </div>

                  <div className="recentMapLocationActions">
                    <button
                      type="button"
                      aria-label={`Centralizar ${location.name}`}
                      onClick={() => {
                        onCenterRecent(
                          location,
                        );
                      }}
                    >
                      Centro
                    </button>

                    <button
                      type="button"
                      aria-label={`Copiar ${location.name}`}
                      onClick={() => {
                        onCopyRecent(
                          location,
                        );
                      }}
                    >
                      {copiedTarget ===
                      `recent:${location.id}`
                        ? 'Copiado'
                        : 'Copiar'}
                    </button>

                    <button
                      type="button"
                      aria-label={`Reutilizar ${location.name}`}
                      onClick={() => {
                        onReuseRecent(
                          location,
                        );
                      }}
                    >
                      Usar
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <p>
            Nenhuma localização recente.
          </p>
        )}
      </section>
    </section>
  );
}
