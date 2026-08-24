import {
  memo,
  useEffect,
  useState,
} from 'react';

import type {
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl';

import type {
  WorkspaceMode,
} from '../../../shared/modules/module.types';

export type MapOperationalHudTimelinePlayback = {
  currentEvent: number;
  eventType: string;
  isPlaying: boolean;
  speed: number;
  totalEvents: number;
};

type MapOperationalHudProps = {
  activeCaseName: string | null;
  map: MapLibreMap | null;
  mode: WorkspaceMode;
  open: boolean;
  rotationEnabled: boolean;
  rotationTemporarilyPaused: boolean;
  timelinePlayback:
    MapOperationalHudTimelinePlayback | null;
  totalMarkers: number;
  totalIpResults: number;
  visibleMarkers: number;
  visibleIpResults: number;

  onOpenChange(open: boolean): void;
};

type CameraTelemetry = {
  distance: string;
  zoom: string;
};

type CursorCoordinates = {
  latitude: string;
  longitude: string;
} | null;

const EMPTY_CAMERA_TELEMETRY:
  CameraTelemetry = {
    distance: '—',
    zoom: '—',
  };

const DISTANCE_FORMATTER =
  new Intl.NumberFormat(
    'pt-BR',
    {
      maximumFractionDigits: 0,
    },
  );

function formatCameraDistance(
  distanceInMeters: number,
): string {
  if (!Number.isFinite(distanceInMeters)) {
    return '—';
  }

  if (distanceInMeters < 1000) {
    return `${DISTANCE_FORMATTER.format(
      distanceInMeters,
    )} m`;
  }

  return `${DISTANCE_FORMATTER.format(
    distanceInMeters / 1000,
  )} km`;
}

export const MapOperationalHud = memo(
  function MapOperationalHud({
    activeCaseName,
    map,
    mode,
    onOpenChange,
    open,
    rotationEnabled,
    rotationTemporarilyPaused,
    timelinePlayback,
    totalIpResults,
    totalMarkers,
    visibleIpResults,
    visibleMarkers,
  }: MapOperationalHudProps) {
    const [
      cameraTelemetry,
      setCameraTelemetry,
    ] = useState<CameraTelemetry>(
      EMPTY_CAMERA_TELEMETRY,
    );
    const [
      cursorCoordinates,
      setCursorCoordinates,
    ] = useState<CursorCoordinates>(null);

    useEffect(() => {
      if (!map || !open) {
        setCameraTelemetry(
          EMPTY_CAMERA_TELEMETRY,
        );
        setCursorCoordinates(null);
        return undefined;
      }

      let cursorFrame:
        number | null = null;
      let pendingCursor:
        CursorCoordinates = null;

      const updateCamera = () => {
        const next = {
          distance:
            formatCameraDistance(
              map.transform
                .getCameraAltitude(),
            ),
          zoom:
            map.getZoom().toFixed(2),
        };

        setCameraTelemetry(
          (current) =>
            current.distance ===
                next.distance &&
              current.zoom === next.zoom
              ? current
              : next,
        );
      };
      const handleMouseMove = (
        event: MapMouseEvent,
      ) => {
        pendingCursor = {
          latitude:
            event.lngLat.lat.toFixed(4),
          longitude:
            event.lngLat.lng.toFixed(4),
        };

        if (cursorFrame !== null) {
          return;
        }

        cursorFrame =
          window.requestAnimationFrame(
            () => {
              cursorFrame = null;
              setCursorCoordinates(
                (current) =>
                  current?.latitude ===
                      pendingCursor?.latitude &&
                    current?.longitude ===
                      pendingCursor?.longitude
                    ? current
                    : pendingCursor,
              );
            },
          );
      };
      const clearCursor = () => {
        pendingCursor = null;
        setCursorCoordinates(null);
      };

      updateCamera();
      map.on('zoom', updateCamera);
      map.on('resize', updateCamera);
      map.on(
        'mousemove',
        handleMouseMove,
      );
      map.getCanvas().addEventListener(
        'mouseleave',
        clearCursor,
      );

      return () => {
        if (cursorFrame !== null) {
          window.cancelAnimationFrame(
            cursorFrame,
          );
        }

        map.off('zoom', updateCamera);
        map.off('resize', updateCamera);
        map.off(
          'mousemove',
          handleMouseMove,
        );
        map.getCanvas().removeEventListener(
          'mouseleave',
          clearCursor,
        );
      };
    }, [map, open]);

    if (!open) {
      return (
        <div className="mapOperationalHud isMinimized">
          <button
            type="button"
            aria-label="Expandir HUD operacional"
            onClick={() => {
              onOpenChange(true);
            }}
          >
            HUD
          </button>
        </div>
      );
    }

    return (
      <aside
        className="mapOperationalHud"
        aria-label="HUD operacional do mapa"
      >
        <header>
          <span>MAP OPS</span>

          <button
            type="button"
            aria-label="Minimizar HUD operacional"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            —
          </button>
        </header>

        <dl>
          <div className="mapHudWideRow">
            <dt>Perfil</dt>
            <dd title={activeCaseName ?? ''}>
              {activeCaseName ??
                'Sem perfil ativo'}
            </dd>
          </div>

          <div className="mapHudWideRow">
            <dt>Marcadores</dt>
            <dd>
              {totalMarkers}
              {' total · '}
              {visibleMarkers}
              {' visíveis'}
            </dd>
          </div>

          <div className="mapHudWideRow">
            <dt>IP Intelligence</dt>
            <dd>
              {totalIpResults}
              {' total · '}
              {visibleIpResults}
              {' visíveis'}
            </dd>
          </div>

          <div>
            <dt>Modo</dt>
            <dd>
              {mode.toUpperCase()}
            </dd>
          </div>

          <div>
            <dt>Zoom</dt>
            <dd>
              {cameraTelemetry.zoom}
            </dd>
          </div>

          <div>
            <dt>Distância</dt>
            <dd>
              {cameraTelemetry.distance}
            </dd>
          </div>

          <div className="mapHudWideRow">
            <dt>Cursor</dt>
            <dd>
              {cursorCoordinates
                ? `Lat ${cursorCoordinates.latitude} · Lon ${cursorCoordinates.longitude}`
                : 'Fora do globo'}
            </dd>
          </div>

          <div className="mapHudWideRow">
            <dt>Rotação</dt>
            <dd
              className={
                rotationEnabled &&
                !rotationTemporarilyPaused
                  ? 'isActive'
                  : undefined
              }
            >
              {rotationTemporarilyPaused
                ? 'Pausada pela timeline'
                : rotationEnabled
                  ? 'Ligada'
                  : 'Desligada'}
            </dd>
          </div>

          {timelinePlayback && (
            <>
              <div className="mapHudWideRow">
                <dt>Timeline geográfica</dt>
                <dd
                  className={
                    timelinePlayback
                      .isPlaying
                      ? 'isActive'
                      : undefined
                  }
                >
                  {timelinePlayback
                    .isPlaying
                    ? 'Reproduzindo'
                    : 'Parado'}
                  {' · '}
                  {
                    timelinePlayback
                      .currentEvent
                  }
                  {' / '}
                  {
                    timelinePlayback
                      .totalEvents
                  }
                </dd>
              </div>

              <div>
                <dt>Velocidade</dt>
                <dd>
                  {timelinePlayback.speed}x
                </dd>
              </div>

              <div>
                <dt>Evento</dt>
                <dd>
                  {
                    timelinePlayback
                      .eventType
                  }
                </dd>
              </div>
            </>
          )}
        </dl>
      </aside>
    );
  },
);
