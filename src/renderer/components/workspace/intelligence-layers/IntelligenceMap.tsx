import { useEffect, useMemo, useRef } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { IntelligencePoint } from '../../../../shared/intelligence-layers/intelligence-types';

const SOURCE = 'zerohub-intelligence';
const IDS = ['zerohub-intel-clusters', 'zerohub-intel-count', 'zerohub-intel-points', 'zerohub-intel-icons', 'zerohub-intel-selected'];
export function IntelligenceMap({ map, points, selectedId, onSelect }: { map: MapLibreMap | null; points: IntelligencePoint[]; selectedId: string | null; onSelect(point: IntelligencePoint): void }): null {
  const data = useMemo((): FeatureCollection<Point> => ({ type: 'FeatureCollection', features: points.map((point) => ({ type: 'Feature', id: point.id, properties: { id: point.id, category: point.category }, geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] } })) }), [points]);
  const current = useRef({ points, onSelect, data, selectedId }); current.current = { points, onSelect, data, selectedId };
  useEffect(() => {
    if (!map) return undefined;
    const onPoint = (event: MapLayerMouseEvent) => { const id = event.features?.[0]?.properties?.id; const point = current.current.points.find((item) => item.id === id); if (point) current.current.onSelect(point); };
    const onCluster = (event: MapLayerMouseEvent) => { const feature = event.features?.[0]; const id = Number(feature?.properties?.cluster_id); if (!feature || feature.geometry.type !== 'Point' || !Number.isInteger(id)) return; void (map.getSource(SOURCE) as GeoJSONSource | undefined)?.getClusterExpansionZoom(id).then((zoom) => map.easeTo({ center: feature.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : [0, 0], zoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 })).catch((): void => { /* Request was discarded. */ }); };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };
    const unbind = () => { map.off('click', IDS[0], onCluster); map.off('click', IDS[2], onPoint); map.off('mouseenter', IDS[0], enter); map.off('mouseleave', IDS[0], leave); map.off('mouseenter', IDS[2], enter); map.off('mouseleave', IDS[2], leave); };
    const mount = () => {
      unbind();
      try {
        if (!map.getStyle()) return;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#aaaaaa';
        if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: current.current.data, cluster: true, clusterRadius: 42, clusterMaxZoom: 13 });
        const before = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
        if (!map.getLayer(IDS[0])) map.addLayer({ id: IDS[0], type: 'circle', source: SOURCE, filter: ['has', 'point_count'], paint: { 'circle-color': accent, 'circle-radius': ['step', ['get', 'point_count'], 15, 20, 19, 100, 23], 'circle-opacity': 0.9, 'circle-stroke-color': '#11191c', 'circle-stroke-width': 2 } }, before);
        if (!map.getLayer(IDS[1])) map.addLayer({ id: IDS[1], type: 'symbol', source: SOURCE, filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 10, 'text-allow-overlap': true }, paint: { 'text-color': '#101419' } });
        if (!map.getLayer(IDS[2])) map.addLayer({ id: IDS[2], type: 'circle', source: SOURCE, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['match', ['get', 'category'], 'health', '#ef8a8a', 'education', '#d5b77c', 'transport', '#8cbbe1', '#9ccaa8'], 'circle-radius': 8, 'circle-stroke-color': '#101419', 'circle-stroke-width': 1.5 } }, before);
        if (!map.getLayer(IDS[3])) map.addLayer({ id: IDS[3], type: 'symbol', source: SOURCE, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['match', ['get', 'category'], 'health', '+', 'education', 'E', 'transport', 'T', 'P'], 'text-size': 9, 'text-allow-overlap': true }, paint: { 'text-color': '#101419' } });
        if (!map.getLayer(IDS[4])) map.addLayer({ id: IDS[4], type: 'circle', source: SOURCE, filter: ['==', ['get', 'id'], current.current.selectedId ?? ''], paint: { 'circle-color': accent, 'circle-opacity': 0.12, 'circle-radius': 15, 'circle-stroke-color': accent, 'circle-stroke-width': 2 } }, before);
        map.setPaintProperty(IDS[0], 'circle-color', accent); map.setPaintProperty(IDS[4], 'circle-color', accent); map.setPaintProperty(IDS[4], 'circle-stroke-color', accent);
        map.setFilter(IDS[4], ['==', ['get', 'id'], current.current.selectedId ?? '']);
        (map.getSource(SOURCE) as GeoJSONSource).setData(current.current.data);
        map.on('click', IDS[0], onCluster); map.on('click', IDS[2], onPoint); map.on('mouseenter', IDS[0], enter); map.on('mouseleave', IDS[0], leave); map.on('mouseenter', IDS[2], enter); map.on('mouseleave', IDS[2], leave);
      } catch { /* style.load retries after a style replacement. */ }
    };
    map.on('style.load', mount);
    const observer = new MutationObserver(mount); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-visual-profile', 'style', 'class'] });
    mount();
    return () => { observer.disconnect(); map.off('style.load', mount); unbind(); leave(); try { for (const id of [...IDS].reverse()) if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(SOURCE)) map.removeSource(SOURCE); } catch { /* Map may already be destroyed. */ } };
  }, [map]);
  useEffect(() => { if (map) (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data); }, [map, data]);
  useEffect(() => { if (map?.getLayer(IDS[4])) map.setFilter(IDS[4], ['==', ['get', 'id'], selectedId ?? '']); }, [map, selectedId]);
  return null;
}
