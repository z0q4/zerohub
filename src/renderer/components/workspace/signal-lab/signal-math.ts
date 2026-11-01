import { bearingDegrees, destinationCoordinate, distanceMeters } from '../geo-measurement';
import type { GeographicCoordinate } from '../geo-measurement';

export type SignalMode = 'distance' | 'bearing';
export type SignalStation = { id: string; coordinate: GeographicCoordinate; measurement: number; sigma: number; label?: string };
export type SignalSolution = { coordinate: GeographicCoordinate; uncertaintyMeters: number; normalizedRms: number; residuals: number[] };
export type SignalResult = { solution: SignalSolution; error?: never } | { solution?: never; error: string };

const radians = (value: number) => value * Math.PI / 180;
const angleDelta = (value: number) => ((value + 540) % 360) - 180;
const MAX_EXTENT = 100_000;

export function isSignalStationValid(mode: SignalMode, station: SignalStation): boolean {
  const { coordinate: [lon, lat], measurement, sigma } = station;
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 && Number.isFinite(measurement) && Number.isFinite(sigma) && sigma > 0 && (mode === 'distance' ? measurement > 0 && measurement <= MAX_EXTENT : measurement >= 0 && measurement < 360);
}

/** Flags a radius at least as large as the median distance from the estimate to its stations. */
export function uncertaintyExceedsStationScale(stations: SignalStation[], solution: SignalSolution): boolean {
  if (!stations.length) return false;
  const distances = stations.map((station) => distanceMeters(station.coordinate, solution.coordinate)).sort((a, b) => a - b);
  const middle = Math.floor(distances.length / 2);
  const median = distances.length % 2 ? distances[middle] : (distances[middle - 1] + distances[middle]) / 2;
  return solution.uncertaintyMeters >= median;
}

function invert(a: number, b: number, c: number): [number, number, number] | null {
  const trace = a + c;
  const discriminant = Math.hypot(a - c, 2 * b);
  const high = (trace + discriminant) / 2;
  const low = (trace - discriminant) / 2;
  if (!(low > high * 0.001) || !Number.isFinite(high)) return null;
  const determinant = a * c - b * b;
  return [c / determinant, -b / determinant, a / determinant];
}

/** Spherical geodesic residuals, with a local tangent-plane adjustment limited to 100 km. */
export function solveSignal(mode: SignalMode, stations: SignalStation[]): SignalResult {
  if (stations.length < 3) return { error: 'Informe pelo menos três estações com medições e incertezas.' };
  if (stations.some((station) => !isSignalStationValid(mode, station))) return { error: 'Revise coordenadas, medições e incertezas positivas. O MVP aceita até 100 km e latitudes até 85°.' };
  const origin = stations[0].coordinate;
  if (stations.some((s) => distanceMeters(origin, s.coordinate) > MAX_EXTENT)) return { error: 'As estações devem estar a até 100 km da primeira estação.' };
  const toXY = (point: GeographicCoordinate): [number, number] => { const d = distanceMeters(origin, point); const b = radians(bearingDegrees(origin, point)); return [d * Math.sin(b), d * Math.cos(b)]; };
  const toGeo = (x: number, y: number): GeographicCoordinate => destinationCoordinate(origin, Math.hypot(x, y), Math.atan2(x, y) * 180 / Math.PI);
  const xy = stations.map((station) => toXY(station.coordinate));
  let aa = 0; let ab = 0; let bb = 0; let ac = 0; let bc = 0;
  for (let i = mode === 'distance' ? 1 : 0; i < stations.length; i++) {
    const [x, y] = xy[i];
    const [x0, y0] = xy[0];
    const bearing = radians(stations[i].measurement);
    const a = mode === 'distance' ? 2 * (x - x0) : Math.cos(bearing);
    const b = mode === 'distance' ? 2 * (y - y0) : -Math.sin(bearing);
    const c = mode === 'distance' ? x * x + y * y - x0 * x0 - y0 * y0 + stations[0].measurement ** 2 - stations[i].measurement ** 2 : a * x + b * y;
    aa += a * a; ab += a * b; bb += b * b; ac += a * c; bc += b * c;
  }
  const initial = invert(aa, ab, bb);
  if (!initial) return { error: 'Geometria degenerada: distribua as estações e direções para obter uma interseção confiável.' };
  let x = initial[0] * ac + initial[1] * bc;
  let y = initial[1] * ac + initial[2] * bc;
  const residual = (station: SignalStation, px: number, py: number) => {
    const point = toGeo(px, py);
    return mode === 'distance' ? distanceMeters(station.coordinate, point) - station.measurement : angleDelta(bearingDegrees(station.coordinate, point) - station.measurement);
  };
  let normal: [number, number, number] | null = null;
  let converged = false;
  for (let iteration = 0; iteration < 30; iteration++) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > MAX_EXTENT) return { error: 'A solução excede o alcance local de 100 km ou não é confiável.' };
    aa = 0; ab = 0; bb = 0; ac = 0; bc = 0;
    for (const station of stations) {
      if (distanceMeters(station.coordinate, toGeo(x, y)) < 1) return { error: 'A posição coincide com uma estação; a solução é indefinida.' };
      const r = residual(station, x, y);
      const dx = (mode === 'bearing' ? angleDelta(residual(station, x + 1, y) - r) : residual(station, x + 1, y) - r);
      const dy = (mode === 'bearing' ? angleDelta(residual(station, x, y + 1) - r) : residual(station, x, y + 1) - r);
      const w = 1 / station.sigma ** 2;
      aa += w * dx * dx; ab += w * dx * dy; bb += w * dy * dy; ac += w * dx * r; bc += w * dy * r;
    }
    normal = invert(aa, ab, bb);
    if (!normal) return { error: 'Geometria degenerada ou insuficiente para estimar a posição.' };
    const sx = normal[0] * ac + normal[1] * bc;
    const sy = normal[1] * ac + normal[2] * bc;
    x -= sx; y -= sy;
    if (Math.hypot(sx, sy) < 0.01) { converged = true; break; }
  }
  if (!converged || !normal || Math.hypot(x, y) > MAX_EXTENT) return { error: 'Não foi possível obter uma solução local convergente.' };
  const residuals = stations.map((station) => residual(station, x, y));
  const normalizedRms = Math.sqrt(residuals.reduce((sum, value, index) => sum + (value / stations[index].sigma) ** 2, 0) / stations.length);
  if (normalizedRms > 3) return { error: 'Medições inconsistentes com as incertezas informadas; nenhuma posição confiável.' };
  const largestVariance = (normal[0] + normal[2] + Math.hypot(normal[0] - normal[2], 2 * normal[1])) / 2;
  const uncertaintyMeters = Math.sqrt(largestVariance) * Math.sqrt(5.991);
  if (!Number.isFinite(uncertaintyMeters) || uncertaintyMeters > MAX_EXTENT) return { error: 'Incerteza excessiva para uma posição confiável.' };
  return { solution: { coordinate: toGeo(x, y), uncertaintyMeters, normalizedRms, residuals } };
}
