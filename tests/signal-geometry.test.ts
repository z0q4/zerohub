import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, destinationCoordinate } from '../src/renderer/components/workspace/geo-measurement';
import { signalFeatures } from '../src/renderer/components/workspace/signal-lab/signal-geometry';
import { solveSignal } from '../src/renderer/components/workspace/signal-lab/signal-math';
import type { SignalStation } from '../src/renderer/components/workspace/signal-lab/signal-math';
import type { GeographicCoordinate } from '../src/renderer/components/workspace/geo-measurement';

const target: GeographicCoordinate = [-34.88, -8.07];
const stations: SignalStation[] = [15, 145, 255].map((bearing, i) => ({ id: String(i), label: String.fromCharCode(65 + i), coordinate: destinationCoordinate(target, 4000, bearing), measurement: 4000, sigma: 50 }));

test('demonstração revela estações, medições e resultado em etapas', () => {
  const result = solveSignal('distance', stations);
  assert.ok(result.solution);
  const initial = signalFeatures('distance', stations, result.solution, 0).data.features;
  assert.deepEqual(initial.map((f) => f.properties?.kind), ['station']);
  const middle = signalFeatures('distance', stations, result.solution, 0.5).data.features;
  assert.equal(middle.filter((f) => f.properties?.kind === 'station').length, 3);
  assert.ok(middle.some((f) => f.properties?.kind === 'measurement'));
  assert.ok(!middle.some((f) => f.properties?.kind === 'result'));
  const full = signalFeatures('distance', stations, result.solution, 1).data.features;
  assert.equal(full.filter((f) => f.properties?.kind === 'station').length, 3);
  assert.equal(full.filter((f) => f.properties?.kind === 'measurement').length, 3);
  assert.ok(full.some((f) => f.properties?.kind === 'uncertainty'));
  for (const feature of full) if (feature.geometry.type === 'Polygon') assert.deepEqual(feature.geometry.coordinates[0][0], feature.geometry.coordinates[0].at(-1));
});

test('azimute e seta seguem a direção geodésica informada', () => {
  const station = { ...stations[0], measurement: bearingDegrees(stations[0].coordinate, target) };
  const features = signalFeatures('bearing', [station], undefined, 1).data.features;
  const lines = features.filter((f) => f.properties?.kind === 'bearing');
  assert.equal(lines.length, 2);
  const line = lines[0].geometry;
  assert.equal(line.type, 'LineString');
  if (line.type === 'LineString') assert.ok(Math.abs(bearingDegrees(station.coordinate, line.coordinates.at(-1) as GeographicCoordinate) - station.measurement) < 0.001);
});

test('geometrias que cruzam o antimeridiano são omitidas e sinalizadas', () => {
  const crossing: SignalStation = { id: 'crossing', coordinate: [179.99, 0], measurement: 5000, sigma: 50 };
  const result = signalFeatures('distance', [crossing], undefined, 1);
  assert.equal(result.omitted, true);
  assert.ok(!result.data.features.some((f) => f.geometry.type === 'Polygon'));
});
