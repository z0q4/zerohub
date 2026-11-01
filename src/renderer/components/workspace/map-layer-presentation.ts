import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';

export type VisualLayerId = 'location-selection' | 'imported-geojson';
export type VisualLayerSettings = { opacity: Record<VisualLayerId, number>; order: VisualLayerId[] };
export const LOCATION_FILL_OPACITY: ExpressionSpecification = ['match', ['get', 'depth'], 0, 0.012, 1, 0.018, 2, 0.035, 3, 0.08, 0.08];

const GROUPS: Record<VisualLayerId, string[]> = {
  'location-selection': ['zerohub-location-fill', 'zerohub-location-casing', 'zerohub-location-outline', 'zerohub-location-halo', 'zerohub-location-point'],
  'imported-geojson': ['imported-geojson-fills', 'imported-geojson-lines', 'imported-geojson-points', 'imported-geojson-clusters', 'imported-geojson-cluster-count'],
};

const PAINT: Record<string, Record<string, number | unknown[]>> = {
  'zerohub-location-fill': { 'fill-opacity': LOCATION_FILL_OPACITY },
  'zerohub-location-casing': { 'line-opacity': 0.8 },
  'zerohub-location-outline': { 'line-opacity': 0.95 },
  'zerohub-location-halo': { 'circle-opacity': 0.25, 'circle-stroke-opacity': 0.65 },
  'zerohub-location-point': { 'circle-opacity': 1, 'circle-stroke-opacity': 1 },
  'imported-geojson-fills': { 'fill-opacity': 0.16 },
  'imported-geojson-lines': { 'line-opacity': 1 },
  'imported-geojson-points': { 'circle-opacity': 1, 'circle-stroke-opacity': 1 },
  'imported-geojson-clusters': { 'circle-opacity': 1 },
  'imported-geojson-cluster-count': { 'text-opacity': 1 },
};

/** Applies only to owned overlays; basemap and other tools retain their styles. */
export function applyLayerPresentation(map: MapLibreMap, settings: VisualLayerSettings, reducedMotion = false, reorder = true): void {
  const owned = new Set(Object.values(GROUPS).flat());
  const anchor = reorder ? map.getStyle()?.layers.find((layer) => layer.type === 'symbol' && !owned.has(layer.id))?.id : undefined;
  for (const group of settings.order) {
    const opacity = Math.max(0, Math.min(1, settings.opacity[group]));
    for (const id of GROUPS[group]) {
      if (!map.getLayer(id)) continue;
      for (const [property, base] of Object.entries(PAINT[id] ?? {})) {
        const value = typeof base === 'number' ? base * opacity : ['*', base, opacity];
        map.setPaintProperty(id, `${property}-transition` as never, { duration: reducedMotion ? 0 : 140 } as never);
        map.setPaintProperty(id, property as never, value as never);
      }
      if (reorder) map.moveLayer(id, anchor);
    }
  }
}
