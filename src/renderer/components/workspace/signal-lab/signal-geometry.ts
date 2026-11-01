import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { destinationCoordinate, distanceMeters } from '../geo-measurement';
import type { GeographicCoordinate } from '../geo-measurement';
import type { SignalMode, SignalSolution, SignalStation } from './signal-math';

const crossesDateLine = (points: GeographicCoordinate[]) => points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180);
export const visibleAt = (index: number, count: number) => count > 0 ? index / count * 0.22 : 0;
const measurementProgress = (progress: number) => Math.max(0, Math.min(1, (progress - 0.22) / 0.78));

export function signalFeatures(mode: SignalMode, stations: SignalStation[], solution: SignalSolution | undefined, progress: number): { data: FeatureCollection; omitted: boolean } {
  const features: Feature<Geometry>[] = [];
  let omitted = false;
  const drawingProgress = measurementProgress(progress);
  for (const [index, station] of stations.entries()) {
    if (progress < visibleAt(index, stations.length)) continue;
    features.push({ type: 'Feature', properties: { kind: 'station', id: station.id, label: station.label ?? String.fromCharCode(65 + index) }, geometry: { type: 'Point', coordinates: station.coordinate } });
    if (mode === 'distance' && station.measurement > 0 && station.measurement <= 100_000) {
      const count = Math.max(1, Math.ceil(64 * drawingProgress));
      const points = Array.from({ length: count + 1 }, (_, pointIndex) => destinationCoordinate(station.coordinate, station.measurement, Math.min(pointIndex / 64, drawingProgress) * 360));
      if (drawingProgress >= 1) points[points.length - 1] = points[0];
      if (crossesDateLine(points)) { omitted = true; continue; }
      if (drawingProgress >= 1) features.push({ type: 'Feature', properties: { kind: 'measurement' }, geometry: { type: 'Polygon', coordinates: [points] } });
      else if (drawingProgress > 0) features.push({ type: 'Feature', properties: { kind: 'measurement' }, geometry: { type: 'LineString', coordinates: points } });
    } else if (mode === 'bearing' && station.measurement >= 0 && station.measurement < 360 && drawingProgress > 0) {
      const length = solution ? Math.min(100_000, distanceMeters(station.coordinate, solution.coordinate) * 1.25) : 10_000;
      const points = Array.from({ length: 17 }, (_, pointIndex) => destinationCoordinate(station.coordinate, length * drawingProgress * pointIndex / 16, station.measurement));
      if (crossesDateLine(points)) { omitted = true; continue; }
      features.push({ type: 'Feature', properties: { kind: 'bearing' }, geometry: { type: 'LineString', coordinates: points } });
      if (length * drawingProgress > 50) {
        const tip = points[points.length - 1];
        const wing = Math.min(300, length * drawingProgress * 0.08);
        const arrow = [destinationCoordinate(tip, wing, station.measurement + 150), tip, destinationCoordinate(tip, wing, station.measurement + 210)];
        if (!crossesDateLine(arrow)) features.push({ type: 'Feature', properties: { kind: 'bearing' }, geometry: { type: 'LineString', coordinates: arrow } });
      }
    }
  }
  if (solution && progress >= 1) {
    const circle = Array.from({ length: 65 }, (_, index) => destinationCoordinate(solution.coordinate, solution.uncertaintyMeters, index * 360 / 64));
    circle[circle.length - 1] = circle[0];
    if (crossesDateLine(circle)) omitted = true;
    else features.push({ type: 'Feature', properties: { kind: 'uncertainty' }, geometry: { type: 'Polygon', coordinates: [circle] } });
    features.push({ type: 'Feature', properties: { kind: 'result' }, geometry: { type: 'Point', coordinates: solution.coordinate } });
  }
  return { data: { type: 'FeatureCollection', features }, omitted };
}
