import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { selectionFeatures } from './location-selection';
import { LOCATION_FILL_OPACITY } from './map-layer-presentation';
import type { LocationSelection } from './location-selection';

const SOURCE = 'zerohub-location-selection';
const IDS = ['zerohub-location-fill', 'zerohub-location-casing', 'zerohub-location-outline', 'zerohub-location-halo', 'zerohub-location-point'];

export function LocationSelectionMapLayer({ map, selection }: { map: MapLibreMap | null; selection: LocationSelection }): null {
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  useEffect(() => {
    if (!map) return undefined;
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#888888';
    const update = () => {
      try {
        if (!map.getStyle()) return;
        if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: selectionFeatures(selectionRef.current) });
        const before = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
        const color = accent();
        if (!map.getLayer(IDS[0])) map.addLayer({ id: IDS[0], type: 'fill', source: SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': LOCATION_FILL_OPACITY, 'fill-opacity-transition': { duration: 300 } } }, before);
        if (!map.getLayer(IDS[1])) map.addLayer({ id: IDS[1], type: 'line', source: SOURCE, filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], paint: { 'line-color': '#111111', 'line-opacity': 0.8, 'line-width': ['case', ['==', ['geometry-type'], 'LineString'], 5, 3.5], 'line-opacity-transition': { duration: 300 } } }, before);
        if (!map.getLayer(IDS[2])) map.addLayer({ id: IDS[2], type: 'line', source: SOURCE, filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], paint: { 'line-color': color, 'line-opacity': 0.95, 'line-width': ['case', ['==', ['geometry-type'], 'LineString'], 3, ['match', ['get', 'depth'], 0, 1.2, 1, 1.5, 2, 2, 2.5]], 'line-opacity-transition': { duration: 300 } } }, before);
        if (!map.getLayer(IDS[3])) map.addLayer({ id: IDS[3], type: 'circle', source: SOURCE, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': color, 'circle-radius': 13, 'circle-opacity': 0.25, 'circle-stroke-color': color, 'circle-stroke-opacity': 0.65, 'circle-stroke-width': 1 } }, before);
        if (!map.getLayer(IDS[4])) map.addLayer({ id: IDS[4], type: 'circle', source: SOURCE, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } }, before);
        (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(selectionFeatures(selectionRef.current));
        for (const [id, property] of [[IDS[0], 'fill-color'], [IDS[2], 'line-color'], [IDS[3], 'circle-color'], [IDS[3], 'circle-stroke-color'], [IDS[4], 'circle-color']]) map.setPaintProperty(id, property, ['coalesce', ['get', 'color'], color]);
      } catch {
        // A style change may temporarily remove sources; style.load retries.
      }
    };
    map.on('style.load', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-visual-profile', 'style', 'class'] });
    update();
    return () => {
      observer.disconnect();
      map.off('style.load', update);
      try { for (const id of [...IDS].reverse()) if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(SOURCE)) map.removeSource(SOURCE); } catch { /* Map may already be removed. */ }
    };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(selectionFeatures(selection));
  }, [map, selection]);
  return null;
}
