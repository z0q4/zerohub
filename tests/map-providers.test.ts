import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseGoogleCoordinate,
  validateGoogleEmbedRequest,
  validateGoogleMapsApiKey,
} from '../src/shared/map-providers/map-providers.validation';

test('coordenadas vazias ou inválidas não se tornam zero', () => {
  for (const value of ['', '  ', 'abc', '91', 'Infinity']) {
    assert.throws(() => parseGoogleCoordinate(value, 'Latitude', -90, 90));
  }
  assert.equal(parseGoogleCoordinate(' -8.0476 ', 'Latitude', -90, 90), -8.0476);
  assert.equal(parseGoogleCoordinate('0', 'Latitude', -90, 90), 0);
});

test(
  'valida e normaliza a chave do Google Maps',
  () => {
    assert.equal(
      validateGoogleMapsApiKey(
        '  map_embed_test_key_1234567890  ',
      ),
      'map_embed_test_key_1234567890',
    );

    assert.throws(
      () =>
        validateGoogleMapsApiKey(
          'curta',
        ),
      TypeError,
    );

    assert.throws(
      () =>
        validateGoogleMapsApiKey(
          'chave com espaço 123456789012345',
        ),
      TypeError,
    );
  },
);

test(
  'aceita solicitações 2D e Street View dentro dos limites',
  () => {
    assert.deepEqual(
      validateGoogleEmbedRequest({
        mode: 'map-2d',
        latitude: -8.0476,
        longitude: -34.877,
        zoom: 12,
      }),
      {
        mode: 'map-2d',
        latitude: -8.0476,
        longitude: -34.877,
        zoom: 12,
        heading: undefined,
        pitch: undefined,
        fov: undefined,
      },
    );

    assert.equal(
      validateGoogleEmbedRequest({
        mode: 'street-360',
        latitude: 90,
        longitude: 180,
        heading: 30,
        pitch: -10,
        fov: 70,
      }).mode,
      'street-360',
    );
  },
);

test(
  'rejeita modalidade e coordenadas inválidas',
  () => {
    assert.throws(
      () =>
        validateGoogleEmbedRequest({
          mode: 'photorealistic-3d',
          latitude: 0,
          longitude: 0,
        }),
      TypeError,
    );

    assert.throws(
      () =>
        validateGoogleEmbedRequest({
          mode: 'street-360',
          latitude: 90.1,
          longitude: 0,
        }),
      TypeError,
    );

    assert.throws(
      () =>
        validateGoogleEmbedRequest({
          mode: 'map-2d',
          latitude: 0,
          longitude: Number.NaN,
        }),
      TypeError,
    );
  },
);
