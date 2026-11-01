import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { applyLayerPresentation } from './map-layer-presentation';
import type { VisualLayerSettings } from './map-layer-presentation';

export function MapLayerPresentation({ map, settings }: { map: MapLibreMap | null; settings: VisualLayerSettings }): null {
  const current = useRef(settings);
  const lastMap = useRef<MapLibreMap | null>(null);
  const lastOrder = useRef('');
  current.current = settings;
  useEffect(() => {
    if (!map) return undefined;
    if (lastMap.current !== map) { lastMap.current = map; lastOrder.current = ''; }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        try {
          const order = current.current.order.join(':');
          applyLayerPresentation(map, current.current, motion.matches, order !== lastOrder.current);
          lastOrder.current = order;
        } catch { /* A style can be replaced while layers are being created. */ }
      });
    };
    const onStyleLoad = () => { lastOrder.current = ''; schedule(); };
    map.on('style.load', onStyleLoad);
    motion.addEventListener('change', schedule);
    schedule();
    return () => { map.off('style.load', onStyleLoad); motion.removeEventListener('change', schedule); if (frame !== null) window.cancelAnimationFrame(frame); };
  }, [map, settings]);
  return null;
}
