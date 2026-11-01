import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { signalFeatures, visibleAt } from './signal-geometry';
import type { SignalMode, SignalSolution, SignalStation } from './signal-math';

const SOURCE = 'zerohub-signal-lab';
const LAYERS = ['zerohub-signal-fill', 'zerohub-signal-line', 'zerohub-signal-bearing', 'zerohub-signal-halo', 'zerohub-signal-points'];
export function SignalLabMap({ map, mode, stations, solution, progress, selectedId, onSelectStation }: { map: MapLibreMap | null; mode: SignalMode; stations: SignalStation[]; solution: SignalSolution | undefined; progress: number; selectedId: string | null; onSelectStation(id: string): void }): null {
  const data = useMemo(() => signalFeatures(mode, stations, solution, progress).data, [mode, stations, solution, progress]);
  const dataRef = useRef(data); dataRef.current = data;
  const selectRef = useRef(onSelectStation); selectRef.current = onSelectStation;
  const markerViews = useRef(new Map<string, { marker: maplibregl.Marker; button: HTMLButtonElement }>());
  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      if (!map.getStyle()) return;
      try {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#aaaaaa';
      if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: dataRef.current });
      const before = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
      if (!map.getLayer(LAYERS[0])) map.addLayer({ id: LAYERS[0], type: 'fill', source: SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': accent, 'fill-opacity': ['case', ['==', ['get', 'kind'], 'uncertainty'], 0.24, 0.035] } }, before);
      if (!map.getLayer(LAYERS[1])) map.addLayer({ id: LAYERS[1], type: 'line', source: SOURCE, filter: ['all', ['!=', ['get', 'kind'], 'bearing'], ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']]], paint: { 'line-color': accent, 'line-width': ['case', ['==', ['get', 'kind'], 'uncertainty'], 2.5, 1.5], 'line-opacity': 0.85 } }, before);
      if (!map.getLayer(LAYERS[2])) map.addLayer({ id: LAYERS[2], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'bearing'], paint: { 'line-color': accent, 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [3, 2] } }, before);
      if (!map.getLayer(LAYERS[3])) map.addLayer({ id: LAYERS[3], type: 'circle', source: SOURCE, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': accent, 'circle-radius': ['case', ['==', ['get', 'kind'], 'result'], 14, 10], 'circle-opacity': 0.22, 'circle-stroke-color': accent, 'circle-stroke-width': 1 } }, before);
      if (!map.getLayer(LAYERS[4])) map.addLayer({ id: LAYERS[4], type: 'circle', source: SOURCE, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': accent, 'circle-radius': ['case', ['==', ['get', 'kind'], 'result'], 5, 4], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } }, before);
      for (const [id, prop] of [[LAYERS[0], 'fill-color'], [LAYERS[1], 'line-color'], [LAYERS[2], 'line-color'], [LAYERS[3], 'circle-color'], [LAYERS[3], 'circle-stroke-color'], [LAYERS[4], 'circle-color']]) map.setPaintProperty(id, prop, accent);
      (map.getSource(SOURCE) as GeoJSONSource).setData(dataRef.current);
      } catch {
        // style.load will recreate the layers if the style is being replaced.
      }
    };
    map.on('style.load', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-visual-profile', 'style', 'class'] });
    update();
    return () => {
      observer.disconnect(); map.off('style.load', update);
      try {
        for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch { /* The map may already have been removed. */ }
    };
  }, [map]);
  useEffect(() => { if (map?.getSource(SOURCE)) (map.getSource(SOURCE) as GeoJSONSource).setData(data); }, [map, data]);
  useEffect(() => {
    if (!map) return undefined;
    const views = markerViews.current;
    return () => { for (const view of views.values()) view.marker.remove(); views.clear(); };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    const views = markerViews.current;
    const visible = stations.filter((station, index) => progress >= visibleAt(index, stations.length));
    const ids = new Set(visible.map((station) => station.id));
    for (const [id, view] of views) if (!ids.has(id)) { view.marker.remove(); views.delete(id); }
    for (const station of visible) {
      let view = views.get(station.id);
      if (!view) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'signalStationMarker';
        button.addEventListener('click', (event) => { event.stopPropagation(); selectRef.current(station.id); });
        button.addEventListener('dblclick', (event) => event.stopPropagation());
        button.addEventListener('mousedown', (event) => event.stopPropagation());
        button.addEventListener('touchstart', (event) => event.stopPropagation());
        const marker = new maplibregl.Marker({ element: button, anchor: 'center' }).setLngLat(station.coordinate).addTo(map);
        view = { marker, button }; views.set(station.id, view);
      }
      const label = station.label ?? String.fromCharCode(65 + stations.indexOf(station));
      view.button.textContent = label;
      view.button.setAttribute('aria-label', `Selecionar estação ${label}: ${station.coordinate[1].toFixed(5)}, ${station.coordinate[0].toFixed(5)}`);
      view.button.setAttribute('aria-pressed', String(station.id === selectedId));
      view.button.title = `Estação ${label} · selecionar`;
      view.marker.setLngLat(station.coordinate);
    }
  }, [map, stations, progress, selectedId]);
  return null;
}
