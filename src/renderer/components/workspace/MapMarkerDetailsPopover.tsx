import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import type {
  Map as MapLibreMap,
} from 'maplibre-gl';

import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
} from './map-workspace.types';

import type {
  GeographicMarker,
  MapMarkerCategory,
  MapMarkerDetailsUpdate,
} from './map-workspace.types';

type MarkerEditDraft =
  MapMarkerDetailsUpdate;

type MapMarkerDetailsPopoverProps = {
  anchorElement: HTMLElement;
  caseBusy: boolean;
  caseName: string | null;
  copied: boolean;
  map: MapLibreMap;
  marker: GeographicMarker;
  viewportElement: HTMLElement;

  onCenter(marker: GeographicMarker): void;

  onClose(): void;

  onCopy(marker: GeographicMarker): void;

  onOpenTimeline(activityId: string): void;

  onRemove(
    marker: GeographicMarker,
  ): Promise<void>;

  onUpdate(
    marker: GeographicMarker,
    draft: MarkerEditDraft,
  ): Promise<void>;
};

const DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  );

const POPOVER_MARGIN = 8;
const POPOVER_GAP = 14;
const MAP_OVERLAY_SELECTORS = [
  '.compactModuleRail',
  '.workspaceSearch',
  '.topRightControls',
  '.mapOperationalHud',
  '.geographicTimelinePanel',
  '.ipGeolocationPanel',
  '.worldGlobeTools',
  '.moduleWorkbenchDrawer',
  '.workspaceModulePanel',
  '.workspaceModeNavigation',
].join(',');

type PositionedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function overlapArea(
  left: PositionedRect,
  right: PositionedRect,
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(
      left.left + left.width,
      right.left + right.width,
    ) -
      Math.max(
        left.left,
        right.left,
      ),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(
      left.top + left.height,
      right.top + right.height,
    ) -
      Math.max(
        left.top,
        right.top,
      ),
  );

  return overlapWidth * overlapHeight;
}

function createDraft(
  marker: GeographicMarker,
): MarkerEditDraft {
  return {
    name: marker.name,
    category: marker.category,
    color: marker.color,
  };
}

function formatCreatedAt(
  createdAt: string,
): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime())
    ? createdAt
    : DATE_FORMATTER.format(date);
}

function coordinateText(
  value: number,
): string {
  return value.toFixed(6);
}

export const MapMarkerDetailsPopover =
  memo(
    function MapMarkerDetailsPopover({
      anchorElement,
      caseBusy,
      caseName,
      copied,
      map,
      marker,
      onCenter,
      onClose,
      onCopy,
      onOpenTimeline,
      onRemove,
      onUpdate,
      viewportElement,
    }: MapMarkerDetailsPopoverProps) {
      const popoverRef =
        useRef<HTMLElement | null>(
          null,
        );
      const mountedRef =
        useRef(true);
      const submittingRef =
        useRef(false);
      const closeButtonRef =
        useRef<HTMLButtonElement | null>(
          null,
        );
      const [
        editing,
        setEditing,
      ] = useState(false);
      const [
        confirmingRemoval,
        setConfirmingRemoval,
      ] = useState(false);
      const [
        submitting,
        setSubmitting,
      ] = useState(false);
      const [
        feedback,
        setFeedback,
      ] = useState<string | null>(null);
      const [
        draft,
        setDraft,
      ] = useState<MarkerEditDraft>(
        () => createDraft(marker),
      );
      const busy =
        caseBusy || submitting;

      useEffect(() => {
        mountedRef.current = true;

        return () => {
          mountedRef.current = false;
        };
      }, []);

      useEffect(() => {
        setEditing(false);
        setConfirmingRemoval(false);
        setSubmitting(false);
        setFeedback(null);
        setDraft(
          createDraft(marker),
        );

        const focusFrame =
          window.requestAnimationFrame(
          () => {
            closeButtonRef.current
              ?.focus();
          },
        );

        return () => {
          window.cancelAnimationFrame(
            focusFrame,
          );
        };
      }, [marker.id]);

      useEffect(() => {
        if (!editing) {
          setDraft(
            createDraft(marker),
          );
        }
      }, [
        editing,
        marker.category,
        marker.color,
        marker.name,
      ]);

      useLayoutEffect(() => {
        let positionFrame:
          number | null = null;

        const positionPopover = () => {
          positionFrame = null;

          const popover =
            popoverRef.current;

          if (!popover) {
            return;
          }

          const viewportBounds =
            viewportElement
              .getBoundingClientRect();
          const anchorBounds =
            anchorElement
              .getBoundingClientRect();
          const popoverBounds =
            popover
              .getBoundingClientRect();
          const anchorX =
            anchorBounds.left -
            viewportBounds.left +
            anchorBounds.width / 2;
          const anchorY =
            anchorBounds.top -
            viewportBounds.top +
            anchorBounds.height / 2;
          const maxLeft = Math.max(
            POPOVER_MARGIN,
            viewportBounds.width -
              popoverBounds.width -
              POPOVER_MARGIN,
          );
          const maxTop = Math.max(
            POPOVER_MARGIN,
            viewportBounds.height -
              popoverBounds.height -
              POPOVER_MARGIN,
          );
          const centeredTop =
            anchorY -
            popoverBounds.height / 2;
          const centeredLeft =
            anchorX -
            popoverBounds.width / 2;
          const candidates = [
            {
              left:
                anchorX + POPOVER_GAP,
              top: centeredTop,
            },
            {
              left:
                anchorX -
                POPOVER_GAP -
                popoverBounds.width,
              top: centeredTop,
            },
            {
              left: centeredLeft,
              top:
                anchorY + POPOVER_GAP,
            },
            {
              left: centeredLeft,
              top:
                anchorY -
                POPOVER_GAP -
                popoverBounds.height,
            },
          ].map(
            (candidate) => ({
              left: clamp(
                candidate.left,
                POPOVER_MARGIN,
                maxLeft,
              ),
              top: clamp(
                candidate.top,
                POPOVER_MARGIN,
                maxTop,
              ),
              width:
                popoverBounds.width,
              height:
                popoverBounds.height,
            }),
          );
          const workspace =
            viewportElement
              .closest<HTMLElement>(
                '.mapWorkspaceShell',
              );
          const obstacles = workspace
            ? Array.from(
              workspace
                .querySelectorAll<HTMLElement>(
                  MAP_OVERLAY_SELECTORS,
                ),
            )
              .filter((element) => {
                const styles =
                  window.getComputedStyle(
                    element,
                  );
                const bounds =
                  element
                    .getBoundingClientRect();

                return (
                  styles.display !==
                    'none' &&
                  styles.visibility !==
                    'hidden' &&
                  bounds.width > 0 &&
                  bounds.height > 0
                );
              })
              .map((element) => {
                const bounds =
                  element
                    .getBoundingClientRect();

                return {
                  left:
                    bounds.left -
                    viewportBounds.left,
                  top:
                    bounds.top -
                    viewportBounds.top,
                  width: bounds.width,
                  height: bounds.height,
                };
              })
            : [];
          const bestCandidate =
            candidates.reduce(
              (best, candidate) => {
                const bestOverlap =
                  obstacles.reduce(
                    (total, obstacle) =>
                      total +
                      overlapArea(
                        best,
                        obstacle,
                      ),
                    0,
                  );
                const candidateOverlap =
                  obstacles.reduce(
                    (total, obstacle) =>
                      total +
                      overlapArea(
                        candidate,
                        obstacle,
                      ),
                    0,
                  );

                return candidateOverlap <
                  bestOverlap
                  ? candidate
                  : best;
              },
            );

          const parentBounds = popover.offsetParent
            ?.getBoundingClientRect();
          popover.style.left =
            `${bestCandidate.left + viewportBounds.left - (parentBounds?.left ?? viewportBounds.left)}px`;
          popover.style.top =
            `${bestCandidate.top + viewportBounds.top - (parentBounds?.top ?? viewportBounds.top)}px`;
        };
        const schedulePosition = () => {
          if (positionFrame !== null) {
            return;
          }

          positionFrame =
            window.requestAnimationFrame(
              positionPopover,
            );
        };

        positionPopover();
        map.on('move', schedulePosition);
        map.on(
          'resize',
          schedulePosition,
        );

        const resizeObserver =
          new ResizeObserver(
            schedulePosition,
          );
        resizeObserver.observe(
          viewportElement,
        );

        if (popoverRef.current) {
          resizeObserver.observe(
            popoverRef.current,
          );
        }

        const workspace =
          viewportElement
            .closest<HTMLElement>(
              '.mapWorkspaceShell',
            );

        workspace
          ?.querySelectorAll<HTMLElement>(
            MAP_OVERLAY_SELECTORS,
          )
          .forEach((element) => {
            resizeObserver.observe(
              element,
            );
          });

        const mutationObserver =
          new MutationObserver(
            schedulePosition,
          );

        if (workspace) {
          mutationObserver.observe(
            workspace,
            {
              attributes: true,
              attributeFilter: [
                'class',
                'hidden',
              ],
              childList: true,
              subtree: true,
            },
          );
        }

        return () => {
          if (positionFrame !== null) {
            window.cancelAnimationFrame(
              positionFrame,
            );
          }

          resizeObserver.disconnect();
          mutationObserver.disconnect();
          map.off(
            'move',
            schedulePosition,
          );
          map.off(
            'resize',
            schedulePosition,
          );
        };
      }, [
        anchorElement,
        map,
        viewportElement,
      ]);

      useEffect(() => {
        const handlePointerDown = (
          event: PointerEvent,
        ) => {
          if (
            event.target instanceof Node &&
            (
              popoverRef.current
                ?.contains(event.target) ||
              anchorElement.contains(
                event.target,
              )
            )
          ) {
            return;
          }

          onClose();
        };
        const handleKeyDown = (
          event: KeyboardEvent,
        ) => {
          if (event.key !== 'Escape') {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          onClose();
          window.requestAnimationFrame(
            () => {
              anchorElement.focus();
            },
          );
        };

        document.addEventListener(
          'pointerdown',
          handlePointerDown,
          true,
        );
        document.addEventListener(
          'keydown',
          handleKeyDown,
        );

        return () => {
          document.removeEventListener(
            'pointerdown',
            handlePointerDown,
            true,
          );
          document.removeEventListener(
            'keydown',
            handleKeyDown,
          );
        };
      }, [
        anchorElement,
        onClose,
      ]);

      async function handleEditSubmit(
        event:
          FormEvent<HTMLFormElement>,
      ): Promise<void> {
        event.preventDefault();

        if (submittingRef.current) {
          return;
        }

        submittingRef.current = true;
        setFeedback(null);
        setSubmitting(true);

        try {
          await onUpdate(
            marker,
            draft,
          );

          if (!mountedRef.current) {
            return;
          }

          setEditing(false);
          setFeedback(
            marker.saved
              ? 'Alteração registrada na timeline.'
              : 'Marcador transitório atualizado.',
          );
        } catch (unknownError) {
          if (!mountedRef.current) {
            return;
          }

          setFeedback(
            unknownError instanceof Error
              ? unknownError.message
              : 'Não foi possível atualizar o marcador.',
          );
        } finally {
          submittingRef.current = false;

          if (mountedRef.current) {
            setSubmitting(false);
          }
        }
      }

      async function handleRemove():
        Promise<void> {
        if (submittingRef.current) {
          return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setFeedback(null);

        try {
          await onRemove(marker);
        } catch (unknownError) {
          if (!mountedRef.current) {
            return;
          }

          setFeedback(
            unknownError instanceof Error
              ? unknownError.message
              : 'Não foi possível remover o marcador.',
          );
        } finally {
          submittingRef.current = false;

          if (mountedRef.current) {
            setSubmitting(false);
          }
        }
      }

      const colorPreset =
        MAP_MARKER_COLORS.find(
          (preset) =>
            preset.id === marker.color,
        );
      const timelineActivityId =
        marker.activityId;

      return (
        <aside
          className="mapMarkerDetailsPopover"
          ref={popoverRef}
          aria-label={`Detalhes do marcador ${marker.name}`}
          role="dialog"
          style={{
            '--marker-color':
              colorPreset?.value ??
              '#78ff63',
          } as React.CSSProperties}
        >
          <header>
            <div>
              <span>MARKER OPS</span>
              <strong>{marker.name}</strong>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Fechar detalhes do marcador"
              onClick={() => {
                onClose();
                window.requestAnimationFrame(
                  () => {
                    anchorElement.focus();
                  },
                );
              }}
            >
              ×
            </button>
          </header>

          {!editing &&
            !confirmingRemoval && (
            <>
              <dl>
                <div>
                  <dt>Categoria</dt>
                  <dd>{marker.category}</dd>
                </div>

                <div>
                  <dt>Cor</dt>
                  <dd className="mapMarkerColorValue">
                    <span aria-hidden="true" />
                    {colorPreset?.label ??
                      marker.color}
                  </dd>
                </div>

                <div>
                  <dt>Latitude</dt>
                  <dd>
                    {coordinateText(
                      marker.latitude,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Longitude</dt>
                  <dd>
                    {coordinateText(
                      marker.longitude,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Origem</dt>
                  <dd>
                    {marker.saved
                      ? 'Salvo no perfil'
                      : 'Transitório'}
                  </dd>
                </div>

                <div>
                  <dt>Criação</dt>
                  <dd>
                    {formatCreatedAt(
                      marker.createdAt,
                    )}
                  </dd>
                </div>

                <div className="mapMarkerDetailWide">
                  <dt>Perfil relacionado</dt>
                  <dd>
                    {marker.caseId && caseName
                      ? caseName
                      : 'Sem perfil relacionado'}
                  </dd>
                </div>
              </dl>

              <div className="mapMarkerPopoverActions">
                <button
                  type="button"
                  onClick={() => {
                    onCenter(marker);
                  }}
                >
                  <span aria-hidden="true">◎</span>
                  Centralizar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCopy(marker);
                  }}
                >
                  <span aria-hidden="true">⧉</span>
                  {copied
                    ? 'Copiado'
                    : 'Copiar'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setEditing(true);
                  }}
                >
                  <span aria-hidden="true">✎</span>
                  Editar
                </button>

                {timelineActivityId && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenTimeline(
                        timelineActivityId,
                      );
                    }}
                  >
                    <span aria-hidden="true">↗</span>
                    Timeline
                  </button>
                )}

                <button
                  className="isDanger"
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setConfirmingRemoval(
                      true,
                    );
                  }}
                >
                  <span aria-hidden="true">×</span>
                  Remover
                </button>
              </div>
            </>
          )}

          {editing && (
            <form
              className="mapMarkerPopoverEditor"
              onSubmit={(event) => {
                void handleEditSubmit(
                  event,
                );
              }}
            >
              <label>
                <span>Nome</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={draft.name}
                  aria-label="Nome do marcador"
                  onChange={(event) => {
                    setDraft(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      }),
                    );
                  }}
                />
              </label>

              <label>
                <span>Categoria</span>
                <select
                  value={draft.category}
                  aria-label="Categoria do marcador"
                  onChange={(event) => {
                    setDraft(
                      (current) => ({
                        ...current,
                        category:
                          event.target.value as MapMarkerCategory,
                      }),
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

              <fieldset>
                <legend>Cor</legend>
                <div className="mapMarkerPopoverColors">
                  {MAP_MARKER_COLORS.map(
                    (color) => (
                      <button
                        key={color.id}
                        type="button"
                        aria-label={color.label}
                        aria-pressed={
                          draft.color ===
                          color.id
                        }
                        title={color.label}
                        style={{
                          '--marker-color':
                            color.value,
                        } as React.CSSProperties}
                        onClick={() => {
                          setDraft(
                            (current) => ({
                              ...current,
                              color:
                                color.id,
                            }),
                          );
                        }}
                      />
                    ),
                  )}
                </div>
              </fieldset>

              <div className="mapMarkerPopoverFormActions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDraft(
                      createDraft(marker),
                    );
                    setFeedback(null);
                    setEditing(false);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="isPrimary"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? 'Salvando...'
                    : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}

          {confirmingRemoval && (
            <section className="mapMarkerRemoveConfirmation">
              <strong>
                Remover {marker.name}?
              </strong>

              <p>
                {marker.saved
                  ? 'O marcador deixará o globo e um evento de remoção será registrado na timeline. O perfil e os demais eventos serão preservados.'
                  : 'Somente este marcador transitório será removido da sessão atual. O perfil e a timeline não serão alterados.'}
              </p>

              <div className="mapMarkerPopoverFormActions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmingRemoval(
                      false,
                    );
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="isDanger"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void handleRemove();
                  }}
                >
                  {busy
                    ? 'Removendo...'
                    : 'Confirmar remoção'}
                </button>
              </div>
            </section>
          )}

          {feedback && (
            <p
              className="mapMarkerPopoverFeedback"
              role="status"
            >
              {feedback}
            </p>
          )}
        </aside>
      );
    },
  );
