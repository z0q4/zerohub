import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, destinationCoordinate, distanceMeters } from '../src/renderer/components/workspace/geo-measurement';
import { isSignalStationValid, solveSignal, uncertaintyExceedsStationScale } from '../src/renderer/components/workspace/signal-lab/signal-math';
import type { SignalMode, SignalStation } from '../src/renderer/components/workspace/signal-lab/signal-math';
import type { GeographicCoordinate } from '../src/renderer/components/workspace/geo-measurement';

const target: GeographicCoordinate = [-34.88, -8.07];
function stations(mode: SignalMode): SignalStation[] {
  return [15, 145, 255].map((bearing, i) => {
    const coordinate = destinationCoordinate(target, [3500, 4200, 5100][i], bearing);
    return { id: String(i), coordinate, measurement: mode === 'distance' ? distanceMeters(coordinate, target) : bearingDegrees(coordinate, target), sigma: mode === 'distance' ? 20 : 0.5 };
  });
}
for (const mode of ['distance', 'bearing'] as const) {
  test(`${mode}: solução geodésica conhecida`, () => {
    const result = solveSignal(mode, stations(mode));
    assert.ok(result.solution, result.error);
    assert.ok(distanceMeters(result.solution.coordinate, target) < 1);
    assert.ok(result.solution.uncertaintyMeters > 0);
  });
  test(`${mode}: ruído pequeno e dados inconsistentes`, () => {
    const input = stations(mode); input[0].measurement += mode === 'distance' ? 10 : 0.2;
    const noisy = solveSignal(mode, input);
    assert.ok(noisy.solution, noisy.error);
    assert.ok(distanceMeters(noisy.solution.coordinate, target) < 60);
    input[0].measurement += mode === 'distance' ? 1000 : 40;
    assert.ok(solveSignal(mode, input).error);
  });
}
test('geometria degenerada, dados ausentes e incerteza inválida', () => {
  const collinear: SignalStation[] = [0, 1000, 2000].map((n, i) => ({ id: String(i), coordinate: destinationCoordinate(target, n, 90), measurement: 1000, sigma: 5 }));
  assert.ok(solveSignal('distance', collinear).error);
  assert.ok(solveSignal('bearing', collinear.map(s => ({ ...s, measurement: 90, sigma: 1 }))).error);
  assert.ok(solveSignal('distance', collinear.slice(0, 2)).error);
  assert.ok(solveSignal('distance', collinear.map(s => ({ ...s, sigma: 0 }))).error);
});
test('círculos sem interseção e direções apontando para longe são rejeitados', () => {
  assert.ok(solveSignal('distance', stations('distance').map((station) => ({ ...station, measurement: 50 }))).error);
  assert.ok(solveSignal('bearing', stations('bearing').map((station) => ({ ...station, measurement: (station.measurement + 180) % 360 }))).error);
});
test('quatro estações reforçam a solução sem alterar o alvo', () => {
  for (const mode of ['distance', 'bearing'] as const) {
    const input = stations(mode);
    const coordinate = destinationCoordinate(target, 6000, 330);
    input.push({ id: 'fourth', coordinate, measurement: mode === 'distance' ? distanceMeters(coordinate, target) : bearingDegrees(coordinate, target), sigma: mode === 'distance' ? 20 : 0.5 });
    const result = solveSignal(mode, input);
    assert.ok(result.solution, result.error);
    assert.ok(distanceMeters(result.solution.coordinate, target) < 1);
  }
});
test('validação individual compartilha os limites aplicados pelo motor', () => {
  const [distance] = stations('distance');
  assert.equal(isSignalStationValid('distance', distance), true);
  assert.equal(isSignalStationValid('distance', { ...distance, sigma: 0 }), false);
  assert.equal(isSignalStationValid('distance', { ...distance, measurement: 100001 }), false);
  assert.equal(isSignalStationValid('bearing', { ...distance, measurement: 359.99 }), true);
  assert.equal(isSignalStationValid('bearing', { ...distance, measurement: 360 }), false);
  assert.equal(isSignalStationValid('bearing', { ...distance, coordinate: [0, 86] }), false);
});
test('alerta de região ampla usa a distância mediana às estações', () => {
  const precise = stations('distance');
  const normal = solveSignal('distance', precise);
  assert.ok(normal.solution, normal.error);
  assert.equal(uncertaintyExceedsStationScale(precise, normal.solution), false);
  const uncertain = precise.map((station) => ({ ...station, sigma: 10000 }));
  const broad = solveSignal('distance', uncertain);
  assert.ok(broad.solution, broad.error);
  assert.equal(uncertaintyExceedsStationScale(uncertain, broad.solution), true);
});
