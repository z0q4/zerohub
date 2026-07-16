import {
  memo,
  useEffect,
} from 'react';

import {
  GEOGRAPHIC_TIMELINE_EVENT_LABELS,
} from './map-marker-activities';
import {
  GEOGRAPHIC_PLAYBACK_SPEEDS,
} from './useGeographicTimelinePlayback';

import type {
  GeographicTimelineEvent,
} from './map-marker-activities';
import type {
  GeographicPlaybackSpeed,
} from './useGeographicTimelinePlayback';

type GeographicTimelinePanelProps = {
  currentEvent:
    GeographicTimelineEvent | null;
  currentIndex: number;
  isPlaying: boolean;
  open: boolean;
  speed: GeographicPlaybackSpeed;
  totalEvents: number;

  onMinimize(): void;
  onNext(): void;
  onOpen(): void;
  onPause(): void;
  onPlay(): void;
  onPrevious(): void;
  onRestart(): void;
  onSeek(index: number): void;
  onSpeedChange(
    speed: GeographicPlaybackSpeed,
  ): void;
};

const DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'medium',
    },
  );

function formatEventDate(
  value: string,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : DATE_FORMATTER.format(date);
}

export const GeographicTimelinePanel =
  memo(
    function GeographicTimelinePanel({
      currentEvent,
      currentIndex,
      isPlaying,
      onMinimize,
      onNext,
      onOpen,
      onPause,
      onPlay,
      onPrevious,
      onRestart,
      onSeek,
      onSpeedChange,
      open,
      speed,
      totalEvents,
    }: GeographicTimelinePanelProps) {
      useEffect(() => {
        if (!open) {
          return undefined;
        }

        const handleEscape = (
          event: KeyboardEvent,
        ): void => {
          if (event.key !== 'Escape') {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onMinimize();
        };

        document.addEventListener(
          'keydown',
          handleEscape,
          true,
        );

        return () => {
          document.removeEventListener(
            'keydown',
            handleEscape,
            true,
          );
        };
      }, [onMinimize, open]);

      if (!open) {
        return (
          <div className="geographicTimelinePanel isMinimized">
            <button
              type="button"
              aria-label="Abrir Timeline Geográfica"
              onClick={onOpen}
            >
              <span aria-hidden="true">
                ◷
              </span>
              GEO TIME
              <small>{totalEvents}</small>
            </button>
          </div>
        );
      }

      const currentNumber =
        currentEvent
          ? currentIndex + 1
          : 0;
      const eventType = currentEvent
        ? GEOGRAPHIC_TIMELINE_EVENT_LABELS[
          currentEvent.type
        ]
        : 'Sem evento';

      return (
        <aside
          className="geographicTimelinePanel"
          aria-label="Timeline Geográfica"
        >
          <header>
            <div>
              <span>
                GEO TIMELINE
              </span>
              <strong>
                {currentEvent?.marker.name ??
                  'Sem eventos geográficos'}
              </strong>
            </div>

            <button
              type="button"
              aria-label="Minimizar Timeline Geográfica"
              onClick={onMinimize}
            >
              —
            </button>
          </header>

          {currentEvent ? (
            <div
              className="geographicTimelineCurrent"
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <span>
                  {eventType}
                </span>
                <strong>
                  {currentNumber}
                  {' / '}
                  {totalEvents}
                </strong>
              </div>

              <p title={currentEvent.title}>
                {currentEvent.title}
              </p>

              <time
                dateTime={
                  currentEvent.occurredAt
                }
              >
                {formatEventDate(
                  currentEvent.occurredAt,
                )}
              </time>
            </div>
          ) : (
            <div
              className="geographicTimelineEmpty"
              role="status"
            >
              Este perfil ainda não possui
              eventos geográficos válidos.
            </div>
          )}

          <label className="geographicTimelineProgress">
            <span>
              Progresso
              <small>
                {currentNumber}
                {' / '}
                {totalEvents}
              </small>
            </span>

            <input
              type="range"
              min={0}
              max={Math.max(
                totalEvents - 1,
                0,
              )}
              step={1}
              value={
                totalEvents > 0
                  ? currentIndex
                  : 0
              }
              disabled={
                totalEvents === 0
              }
              aria-label="Selecionar evento da Timeline Geográfica"
              onChange={(event) => {
                onSeek(
                  Number(
                    event.target.value,
                  ),
                );
              }}
            />
          </label>

          <div className="geographicTimelineControls">
            <button
              type="button"
              aria-label="Evento geográfico anterior"
              disabled={
                totalEvents === 0 ||
                currentIndex === 0
              }
              onClick={onPrevious}
            >
              ◀
            </button>

            <button
              className="isPrimary"
              type="button"
              aria-label={
                isPlaying
                  ? 'Pausar Timeline Geográfica'
                  : 'Reproduzir Timeline Geográfica'
              }
              aria-pressed={isPlaying}
              disabled={
                totalEvents <= 1
              }
              onClick={
                isPlaying
                  ? onPause
                  : onPlay
              }
            >
              {isPlaying
                ? 'Ⅱ'
                : '▶'}
            </button>

            <button
              type="button"
              aria-label="Próximo evento geográfico"
              disabled={
                totalEvents === 0 ||
                currentIndex >=
                  totalEvents - 1
              }
              onClick={onNext}
            >
              ▶
            </button>

            <button
              type="button"
              aria-label="Reiniciar Timeline Geográfica"
              disabled={
                totalEvents === 0
              }
              onClick={onRestart}
            >
              ↺
            </button>

            <label>
              <span>Velocidade</span>
              <select
                value={speed}
                aria-label="Velocidade da Timeline Geográfica"
                onChange={(event) => {
                  const nextSpeed =
                    Number(
                      event.target.value,
                    ) as GeographicPlaybackSpeed;

                  if (
                    GEOGRAPHIC_PLAYBACK_SPEEDS
                      .includes(nextSpeed)
                  ) {
                    onSpeedChange(
                      nextSpeed,
                    );
                  }
                }}
              >
                {GEOGRAPHIC_PLAYBACK_SPEEDS
                  .map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}x
                      </option>
                    ),
                  )}
              </select>
            </label>
          </div>
        </aside>
      );
    },
  );
