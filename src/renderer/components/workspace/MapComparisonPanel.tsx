import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FeatureCollection,
  LineString,
  Point,
} from 'geojson';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
} from 'maplibre-gl';
import {
  bearingDegrees,
  distanceMeters,
} from './geo-measurement';
import {
  useScopedWorkspaceState,
} from './useScopedWorkspaceState';
import type {
  GeographicCoordinate,
} from './geo-measurement';

export type GeographicComparisonItem = {
  id: string;
  coordinate: GeographicCoordinate;
  label: string;
  origin: string;
  precision: string;
  details: string | null;
};

type MapComparisonPanelProps = {
  items: GeographicComparisonItem[];
  map: MapLibreMap | null;
  scopeId: string;
  visible: boolean;

  onCountChange(count: number): void;
};

const SOURCE_ID = 'geographic-comparison';
const LINE_LAYER_ID =
  'geographic-comparison-line';
const POINT_LAYER_ID =
  'geographic-comparison-points';
const MAX_SELECTED_ITEMS = 4;
const EMPTY_SELECTED_IDS: string[] = [];

function buildComparisonData(
  items: GeographicComparisonItem[],
): FeatureCollection<Point | LineString> {
  const features: FeatureCollection<
    Point | LineString
  >['features'] = items.map(
    (item) => ({
      type: 'Feature',
      properties: {
        id: item.id,
        label: item.label,
      },
      geometry: {
        type: 'Point',
        coordinates: item.coordinate,
      },
    }),
  );

  if (items.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'comparison',
      },
      geometry: {
        type: 'LineString',
        coordinates: items.map(
          (item) => item.coordinate,
        ),
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function MapComparisonPanel({
  items,
  map,
  onCountChange,
  scopeId,
  visible,
}: MapComparisonPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] =
    useScopedWorkspaceState<
      string[]
    >(
      scopeId,
      EMPTY_SELECTED_IDS,
    );
  const selectedItems = useMemo(
    () => selectedIds.flatMap(
      (id) => {
        const item = items.find(
          (candidate) => candidate.id === id,
        );
        return item ? [item] : [];
      },
    ),
    [items, selectedIds],
  );
  const data = useMemo(
    () => buildComparisonData(
      selectedItems,
    ),
    [selectedItems],
  );
  const visibleData = useMemo(
    () => visible
      ? data
      : {
        type: 'FeatureCollection' as const,
        features: [],
      },
    [data, visible],
  );
  const firstPair = selectedItems.length >= 2
    ? {
      distance: distanceMeters(
        selectedItems[0].coordinate,
        selectedItems[1].coordinate,
      ),
      bearing: bearingDegrees(
        selectedItems[0].coordinate,
        selectedItems[1].coordinate,
      ),
    }
    : null;

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) =>
        items.some((item) => item.id === id),
      ),
    );
  }, [items]);

  useEffect(() => {
    onCountChange(selectedItems.length);
  }, [
    onCountChange,
    selectedItems.length,
  ]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const cleanup = () => {
      try {
        for (const id of [
          POINT_LAYER_ID,
          LINE_LAYER_ID,
        ]) {
          if (map.getLayer(id)) {
            map.removeLayer(id);
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
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: visibleData,
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#ffe45c',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-color': '#ffe45c',
          'circle-radius': 7,
          'circle-stroke-color': '#fff7c9',
          'circle-stroke-width': 1.5,
        },
      });
    } catch (unknownError) {
      console.error(
        '[Comparação] Falha ao montar camada.',
        unknownError,
      );
      cleanup();
    }

    return cleanup;
  }, [map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    try {
      (map.getSource(
        SOURCE_ID,
      ) as GeoJSONSource | undefined)
        ?.setData(visibleData);
    } catch {
      // Atualização tardia após desmontagem.
    }
  }, [map, visibleData]);

  return (
    <>
      <button
        className="mapComparisonToggle"
        type="button"
        aria-controls="map-comparison-panel"
        aria-expanded={open}
        aria-label="Comparar localizações"
        onClick={() => setOpen(
          (current) => !current,
        )}
      >
        Δ
      </button>

      <section
        id="map-comparison-panel"
        className="mapComparisonPanel"
        hidden={!open}
        aria-label="Comparação geográfica"
      >
        <header>
          <div>
            <span>COMPARAÇÃO</span>
            <strong>Localizações selecionadas</strong>
          </div>
          <button
            type="button"
            aria-label="Fechar comparação"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="mapComparisonList">
          {items.length === 0 && (
            <p>
              Pesquise, consulte um IP ou crie um marcador para comparar.
            </p>
          )}
          {items.map((item) => {
            const checked = selectedIds.includes(
              item.id,
            );
            return (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={
                    !checked &&
                    selectedIds.length >=
                      MAX_SELECTED_ITEMS
                  }
                  onChange={() => {
                    setSelectedIds((current) =>
                      current.includes(item.id)
                        ? current.filter(
                          (id) => id !== item.id,
                        )
                        : [...current, item.id]
                          .slice(0, MAX_SELECTED_ITEMS),
                    );
                  }}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.origin} · {item.precision}
                    {item.details
                      ? ` · ${item.details}`
                      : ''}
                  </small>
                </span>
              </label>
            );
          })}
        </div>

        {firstPair && (
          <dl>
            <div>
              <dt>Distância</dt>
              <dd>
                {(firstPair.distance / 1000).toFixed(2)} km
              </dd>
            </div>
            <div>
              <dt>Azimute</dt>
              <dd>{firstPair.bearing.toFixed(1)}°</dd>
            </div>
          </dl>
        )}

        <button
          type="button"
          onClick={() => setSelectedIds([])}
        >
          Limpar seleção
        </button>
        <small>
          A linha é comparação geodésica e não representa rota nem precisão equivalente entre fontes.
        </small>
      </section>
    </>
  );
}
