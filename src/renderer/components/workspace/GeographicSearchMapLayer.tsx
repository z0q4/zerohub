import {
  memo,
  useEffect,
} from 'react';

import type {
  GeoJSONSource,
  Map as MapLibreMap,
} from 'maplibre-gl';
import type {
  Feature,
  FeatureCollection,
  Point,
} from 'geojson';
import type {
  GeographicSearchResult,
} from '../../../shared/geographic-search/geographic-search.types';

type GeographicSearchMapLayerProps = {
  map: MapLibreMap | null;
  result: GeographicSearchResult | null;
  onSelect(): void;
};

const SOURCE_ID =
  'geographic-search-result';
const HALO_LAYER_ID =
  'geographic-search-result-halo';
const POINT_LAYER_ID =
  'geographic-search-result-point';
const HITBOX_LAYER_ID =
  'geographic-search-result-hitbox';

function buildData(
  result: GeographicSearchResult | null,
): FeatureCollection<Point> {
  const features: Feature<Point>[] =
    result
      ? [{
        type: 'Feature',
        id: result.id,
        properties: {
          resultId: result.id,
          type: result.type,
        },
        geometry: {
          type: 'Point',
          coordinates: [
            result.longitude,
            result.latitude,
          ],
        },
      }]
      : [];

  return {
    type: 'FeatureCollection',
    features,
  };
}

export const GeographicSearchMapLayer =
  memo(function GeographicSearchMapLayer({
    map,
    onSelect,
    result,
  }: GeographicSearchMapLayerProps) {
    useEffect(() => {
      if (!map) {
        return undefined;
      }

      const handleClick = () => {
        onSelect();
      };
      const handleEnter = () => {
        map.getCanvas().style.cursor =
          'pointer';
      };
      const handleLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      const cleanup = () => {
        try {
          for (const layerId of [
            HITBOX_LAYER_ID,
            POINT_LAYER_ID,
            HALO_LAYER_ID,
          ]) {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
          }

          if (map.getSource(SOURCE_ID)) {
            map.removeSource(SOURCE_ID);
          }
        } catch {
          // O mapa pode ter sido desmontado.
        }
      };

      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: buildData(result),
          });
        }

        if (!map.getLayer(HALO_LAYER_ID)) {
          map.addLayer({
            id: HALO_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color':
                'rgba(71, 219, 255, 0.18)',
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0.25,
                5,
                8,
                12,
                18,
                19,
              ],
              'circle-blur': 0.35,
              'circle-stroke-color':
                'rgba(71, 219, 255, 0.45)',
              'circle-stroke-width': 1,
            },
          });
        }

        if (!map.getLayer(POINT_LAYER_ID)) {
          map.addLayer({
            id: POINT_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#47dbff',
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0.25,
                2.5,
                8,
                5,
                18,
                8,
              ],
              'circle-stroke-color':
                '#ecfbff',
              'circle-stroke-width': 1.5,
            },
          });
        }

        if (!map.getLayer(HITBOX_LAYER_ID)) {
          map.addLayer({
            id: HITBOX_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color':
                'rgba(255,255,255,0.001)',
              'circle-radius': 16,
            },
          });
        }

        map.on(
          'click',
          HITBOX_LAYER_ID,
          handleClick,
        );
        map.on(
          'mouseenter',
          HITBOX_LAYER_ID,
          handleEnter,
        );
        map.on(
          'mouseleave',
          HITBOX_LAYER_ID,
          handleLeave,
        );
      } catch (unknownError) {
        console.error(
          '[Busca geográfica] Falha ao montar camada vetorial.',
          unknownError,
        );
        cleanup();
      }

      return () => {
        map.off(
          'click',
          HITBOX_LAYER_ID,
          handleClick,
        );
        map.off(
          'mouseenter',
          HITBOX_LAYER_ID,
          handleEnter,
        );
        map.off(
          'mouseleave',
          HITBOX_LAYER_ID,
          handleLeave,
        );
        handleLeave();
        cleanup();
      };
    }, [map, onSelect]);

    useEffect(() => {
      if (!map) {
        return;
      }

      try {
        const source = map.getSource(
          SOURCE_ID,
        ) as GeoJSONSource | undefined;
        source?.setData(buildData(result));
      } catch {
        // Atualização tardia após desmontagem.
      }
    }, [map, result]);

    return null;
  });
