import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

type Coordinates = { latitude: number; longitude: number };

function formatDms(value: number, positive: string, negative: string): string {
  const hundredths = Math.round(Math.abs(value) * 360000);
  const degrees = Math.floor(hundredths / 360000);
  const minutes = Math.floor((hundredths % 360000) / 6000);
  const seconds = ((hundredths % 6000) / 100).toFixed(2);
  return `${degrees}°${minutes}′${seconds}″${value < 0 || Object.is(value, -0) ? negative : positive}`;
}

function formatCoordinates(value: Coordinates, dms: boolean): string {
  return dms
    ? `${formatDms(value.latitude, 'N', 'S')} ${formatDms(value.longitude, 'E', 'W')}`
    : `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`;
}

export function MapCoordinateStatus({ map, active, fallbackCenter }: { map: MapLibreMap | null; active: boolean; fallbackCenter: Coordinates }) {
  const [dms, setDms] = useState(false);
  const [center, setCenter] = useState<Coordinates | null>(null);
  const [cursor, setCursor] = useState<Coordinates | null>(null);
  const [hasCursor, setHasCursor] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const lastCursor = useRef<Coordinates | null>(null);

  useEffect(() => {
    if (!map || !active) {
      lastCursor.current = null;
      setCursor(null);
      setHasCursor(false);
      setCopyFeedback('');
      return undefined;
    }

    let frame: number | null = null;
    let pendingCursor: Coordinates | null = null;
    let updateCenter = false;
    const flush = () => {
      frame = null;
      if (updateCenter) {
        const next = map.getCenter();
        setCenter({ latitude: next.lat, longitude: next.lng });
        updateCenter = false;
      }
      if (pendingCursor) {
        setCursor(pendingCursor);
        pendingCursor = null;
      }
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(flush);
    };
    const onMove = () => { updateCenter = true; schedule(); };
    const onMouseMove = (event: MapMouseEvent) => {
      const { lat, lng } = event.lngLat;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      pendingCursor = { latitude: lat, longitude: lng };
      if (!lastCursor.current) setHasCursor(true);
      lastCursor.current = pendingCursor;
      schedule();
    };
    const onLeave = () => {
      pendingCursor = null;
      setCursor(null);
    };
    const canvas = map.getCanvas();
    onMove();
    map.on('move', onMove);
    map.on('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      map.off('move', onMove);
      map.off('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [map, active]);

  const displayedCenter = active && center ? center : fallbackCenter;
  return <span className="mapCoordinateStatus">
    <span className="mapCoordinateCenter" title={active ? 'Centro do mapa' : 'Último centro do mapa ZeroHub'}>Centro ZeroHub {formatCoordinates(displayedCenter, dms)}</span>
    {active && cursor && <span className="mapCoordinateCursor">Cursor {formatCoordinates(cursor, dms)}</span>}
    {active && <button type="button" aria-label={`Formato de coordenadas: ${dms ? 'DMS' : 'DD'}. Alternar formato`} title="Alternar entre graus decimais e graus, minutos e segundos" onClick={() => setDms((current) => !current)}>{dms ? 'DMS' : 'DD'}</button>}
    {active && hasCursor && <button type="button" aria-label="Copiar última posição do cursor com precisão original" title="Copiar última posição do cursor com precisão original" onClick={() => {
      const position = lastCursor.current;
      if (!position) return;
      void window.zeroHub.clipboard.writeText(`${position.latitude}, ${position.longitude}`).then(() => setCopyFeedback('Copiado')).catch(() => setCopyFeedback('Falha ao copiar'));
    }}>Copiar cursor</button>}
    {active && <span className="mapCoordinateFeedback" role="status">{copyFeedback}</span>}
  </span>;
}
