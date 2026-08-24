import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  Point,
  Polygon,
} from 'geojson';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl';
import {
  bearingDegrees,
  destinationCoordinate,
  distanceMeters,
  normalizeLongitude,
  polygonAreaSquareMeters,
} from './geo-measurement';
import {
  useScopedWorkspaceState,
} from './useScopedWorkspaceState';
import type {
  GeographicCoordinate,
} from './geo-measurement';

type Coordinate = GeographicCoordinate;
export type MeasurementMode =
  | 'distance'
  | 'area'
  | 'radius'
  | null;

type MapMeasurementToolsProps = {
  activeCaseName: string | null;
  map: MapLibreMap | null;
  scopeId: string;
  visible: boolean;

  onCountChange(count: number): void;
  onSaveToCase?(
    data: FeatureCollection,
    mode: Exclude<MeasurementMode, null>,
    summary: string,
  ): Promise<void>;
};

const SOURCE_ID = 'map-measurements';
const FILL_LAYER_ID =
  'map-measurements-fill';
const LINE_LAYER_ID =
  'map-measurements-line';
const POINT_LAYER_ID =
  'map-measurements-points';
const MAX_MEASUREMENT_POINTS = 100;
const EMPTY_COORDINATES: Coordinate[] = [];

export function buildMeasurementData(
  points: Coordinate[],
  preview: Coordinate | null,
  mode: MeasurementMode,
): FeatureCollection {
  const coordinates = preview
    ? [...points, preview]
    : points;
  const features: Feature<
    Geometry,
    GeoJsonProperties
  >[] = coordinates.map(
    (coordinate, index): Feature<Point> => ({
      type: 'Feature',
      properties: {
        index,
        preview:
          preview !== null &&
          index === coordinates.length - 1,
      },
      geometry: {
        type: 'Point',
        coordinates: coordinate,
      },
    }),
  );

  if (
    (mode === 'distance' || mode === 'area') &&
    coordinates.length >= 2
  ) {
    features.push({
      type: 'Feature',
      properties: {
        kind: mode,
      },
      geometry: {
        type: 'LineString',
        coordinates,
      } satisfies LineString,
    });
  }

  if (
    mode === 'area' &&
    coordinates.length >= 3
  ) {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'area',
        areaSquareMeters:
          polygonAreaSquareMeters(coordinates),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...coordinates,
          coordinates[0],
        ]],
      } satisfies Polygon,
    });
  }

  if (
    mode === 'radius' &&
    coordinates.length >= 2
  ) {
    const center = coordinates[0];
    const radius = distanceMeters(
      center,
      coordinates[1],
    );
    const ring = Array.from(
      { length: 65 },
      (_, index) => destinationCoordinate(
        center,
        radius,
        index * 360 / 64,
      ),
    );

    features.push({
      type: 'Feature',
      properties: {
        kind: 'radius',
        radiusMeters: radius,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      } satisfies Polygon,
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function accumulatedDistance(
  coordinates: Coordinate[],
): number {
  return coordinates.reduce(
    (total, coordinate, index) =>
      index === 0
        ? 0
        : total + distanceMeters(
          coordinates[index - 1],
          coordinate,
        ),
    0,
  );
}

export function MapMeasurementTools({
  activeCaseName,
  map,
  onCountChange,
  onSaveToCase,
  scopeId,
  visible,
}: MapMeasurementToolsProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] =
    useScopedWorkspaceState<
      MeasurementMode
    >(scopeId, null);
  const [points, setPoints] =
    useScopedWorkspaceState<
      Coordinate[]
    >(
      scopeId,
      EMPTY_COORDINATES,
    );
  const [preview, setPreview] =
    useScopedWorkspaceState<
      Coordinate | null
    >(scopeId, null);
  const [unit, setUnit] =
    useState<'metric' | 'imperial'>(
      'metric',
    );
  const [feedback, setFeedback] =
    useState<string | null>(null);
  const [saving, setSaving] =
    useState(false);
  const data = useMemo(
    () => buildMeasurementData(
      points,
      preview,
      mode,
    ),
    [mode, points, preview],
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
  const totalMeters = useMemo(
    () => accumulatedDistance(
      mode === 'radius'
        ? points.slice(0, 2)
        : points,
    ),
    [mode, points],
  );
  const areaSquareMeters = useMemo(
    () => mode === 'area'
      ? polygonAreaSquareMeters(points)
      : 0,
    [mode, points],
  );
  const azimuth =
    points.length >= 2
      ? bearingDegrees(
        points[0],
        points[points.length - 1],
      )
      : null;
  const formattedDistance = unit === 'metric'
    ? totalMeters < 1000
      ? `${totalMeters.toFixed(1)} m`
      : `${(totalMeters / 1000).toFixed(2)} km`
    : `${(totalMeters / 1609.344).toFixed(2)} mi`;
  const formattedArea = unit === 'metric'
    ? areaSquareMeters < 1_000_000
      ? `${areaSquareMeters.toFixed(1)} m²`
      : `${(areaSquareMeters / 1_000_000).toFixed(2)} km²`
    : `${(areaSquareMeters / 2_589_988.11).toFixed(2)} mi²`;

  useEffect(() => {
    onCountChange(points.length);
  }, [onCountChange, points.length]);

  const clear = useCallback(() => {
    setMode(null);
    setPoints([]);
    setPreview(null);
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const handleClick = (
      event: MapMouseEvent,
    ) => {
      if (
        !visible ||
        !mode ||
        event.originalEvent.ctrlKey
      ) {
        return;
      }

      const coordinate: Coordinate = [
        normalizeLongitude(event.lngLat.lng),
        event.lngLat.lat,
      ];
      setPoints((current) => {
        if (mode === 'radius') {
          return current.length === 0
            ? [coordinate]
            : [current[0], coordinate];
        }

        return current.length <
          MAX_MEASUREMENT_POINTS
          ? [...current, coordinate]
          : current;
      });
      setPreview(null);
    };
    const handleMove = (
      event: MapMouseEvent,
    ) => {
      if (
        !visible ||
        !mode ||
        points.length === 0 ||
        (
          mode === 'radius' &&
          points.length >= 2
        )
      ) {
        setPreview(null);
        return;
      }

      setPreview([
        normalizeLongitude(event.lngLat.lng),
        event.lngLat.lat,
      ]);
    };

    map.on('click', handleClick);
    map.on('mousemove', handleMove);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMove);
    };
  }, [map, mode, points.length, visible]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const cleanup = () => {
      try {
        for (const id of [
          POINT_LAYER_ID,
          LINE_LAYER_ID,
          FILL_LAYER_ID,
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
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: visibleData,
        });
      }
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#52e5ff',
          'fill-opacity': 0.13,
        },
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#52e5ff',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-color': '#52e5ff',
          'circle-radius': 5,
          'circle-stroke-color': '#e9fdff',
          'circle-stroke-width': 1,
        },
      });
    } catch (unknownError) {
      console.error(
        '[Medição] Falha ao montar camada.',
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
      const source = map.getSource(
        SOURCE_ID,
      ) as GeoJSONSource | undefined;
      source?.setData(visibleData);
    } catch {
      // Atualização tardia após desmontagem.
    }
  }, [map, visibleData]);

  useEffect(() => {
    if (!mode) {
      return undefined;
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        clear();
      }
    };
    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [clear, mode]);

  const copyGeoJson = useCallback(() => {
    void window.zeroHub.clipboard
      .writeText(
        JSON.stringify(data, null, 2),
      )
      .then(() => {
        setFeedback('GeoJSON copiado.');
      })
      .catch(() => {
        setFeedback(
          'Não foi possível copiar o GeoJSON.',
        );
      });
  }, [data]);

  const undoLastPoint = useCallback(() => {
    setPoints((current) => current.slice(0, -1));
    setPreview(null);
    setFeedback('Último ponto removido.');
  }, []);

  const updateVertex = useCallback((
    index: number,
    axis: 'longitude' | 'latitude',
    rawValue: string,
  ) => {
    const value = Number(rawValue);
    const isValid = Number.isFinite(value) && (
      axis === 'longitude'
        ? value >= -180 && value <= 180
        : value >= -90 && value <= 90
    );

    if (!isValid) {
      setFeedback(
        axis === 'longitude'
          ? 'Longitude deve estar entre -180 e 180.'
          : 'Latitude deve estar entre -90 e 90.',
      );
      return;
    }

    setPoints((current) => current.map(
      (coordinate, currentIndex) =>
        currentIndex === index
          ? axis === 'longitude'
            ? [normalizeLongitude(value), coordinate[1]]
            : [coordinate[0], value]
          : coordinate,
    ));
    setFeedback(`Vértice ${index + 1} atualizado.`);
  }, []);

  const removeVertex = useCallback((index: number) => {
    setPoints((current) => current.filter(
      (_, currentIndex) => currentIndex !== index,
    ));
    setPreview(null);
    setFeedback(`Vértice ${index + 1} removido.`);
  }, []);

  const saveToCase = useCallback(async () => {
    if (
      !activeCaseName ||
      !mode ||
      points.length === 0 ||
      !onSaveToCase ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await onSaveToCase(
        data,
        mode,
        mode === 'area'
          ? `${formattedArea} · perímetro ${formattedDistance}`
          : formattedDistance,
      );
      setFeedback(
        `Medição registrada em ${activeCaseName}.`,
      );
    } catch {
      setFeedback(
        'Não foi possível registrar a medição no case.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    activeCaseName,
    data,
    formattedArea,
    formattedDistance,
    mode,
    onSaveToCase,
    points.length,
    saving,
  ]);

  return (
    <>
      <button
        className="mapMeasurementToggle"
        type="button"
        aria-controls="map-measurement-panel"
        aria-expanded={open}
        aria-label="Ferramentas de medição"
        onClick={() => setOpen(
          (current) => !current,
        )}
      >
        ↔
      </button>

      <section
        id="map-measurement-panel"
        className="mapMeasurementPanel"
        hidden={!open}
        aria-label="Medição geográfica"
      >
        <header>
          <div>
            <span>MEDIÇÃO</span>
            <strong>Geodésica aproximada</strong>
          </div>
          <button
            type="button"
            aria-label="Fechar medição"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="mapMeasurementModes">
          <button
            type="button"
            aria-pressed={mode === 'distance'}
            onClick={() => {
              clear();
              setMode('distance');
            }}
          >
            Distância
          </button>
          <button
            type="button"
            aria-pressed={mode === 'area'}
            onClick={() => {
              clear();
              setMode('area');
            }}
          >
            Área
          </button>
          <button
            type="button"
            aria-pressed={mode === 'radius'}
            onClick={() => {
              clear();
              setMode('radius');
            }}
          >
            Raio
          </button>
        </div>

        <dl>
          <div>
            <dt>Pontos</dt>
            <dd>{points.length}</dd>
          </div>
          <div>
            <dt>{mode === 'area' ? 'Perímetro' : 'Distância'}</dt>
            <dd>{formattedDistance}</dd>
          </div>
          <div>
            <dt>{mode === 'area' ? 'Área' : 'Azimute'}</dt>
            <dd>{mode === 'area'
              ? formattedArea
              : azimuth === null
                ? '—'
                : `${azimuth.toFixed(1)}°`}</dd>
          </div>
        </dl>

        <label>
          Unidade
          <select
            value={unit}
            onChange={(event) => {
              setUnit(
                event.target.value as
                  'metric' | 'imperial',
              );
            }}
          >
            <option value="metric">m / km</option>
            <option value="imperial">milhas</option>
          </select>
        </label>

        {points.length > 0 ? (
          <fieldset className="mapMeasurementVertices">
            <legend>Vértices</legend>
            <div>
              {points.map((point, index) => (
                <div
                  className="mapMeasurementVertex"
                  key={`${index}-${point[0]}-${point[1]}`}
                >
                  <span>{index + 1}</span>
                  <label>
                    <span>Longitude</span>
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      defaultValue={point[0]}
                      aria-label={`Longitude do vértice ${index + 1}`}
                      onBlur={(event) => updateVertex(
                        index,
                        'longitude',
                        event.currentTarget.value,
                      )}
                    />
                  </label>
                  <label>
                    <span>Latitude</span>
                    <input
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      defaultValue={point[1]}
                      aria-label={`Latitude do vértice ${index + 1}`}
                      onBlur={(event) => updateVertex(
                        index,
                        'latitude',
                        event.currentTarget.value,
                      )}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remover vértice ${index + 1}`}
                    onClick={() => removeVertex(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mapMeasurementActions">
          <button
            type="button"
            disabled={points.length === 0}
            onClick={undoLastPoint}
          >
            Desfazer
          </button>
          <button
            type="button"
            disabled={points.length === 0}
            onClick={() => setMode(null)}
          >
            Finalizar
          </button>
          <button
            type="button"
            disabled={points.length === 0}
            onClick={copyGeoJson}
          >
            Copiar GeoJSON
          </button>
          <button
            type="button"
            disabled={
              saving ||
              points.length === 0 ||
              !activeCaseName
            }
            onClick={() => {
              void saveToCase();
            }}
          >
            {saving ? 'Salvando…' : 'Salvar no case'}
          </button>
          <button type="button" onClick={clear}>
            Limpar
          </button>
        </div>

        <p aria-live="polite">
          {feedback ?? (
            mode
              ? 'Clique no mapa para adicionar pontos. Escape cancela.'
              : 'Escolha distância, área ou raio.'
          )}
        </p>
        <small>
          Cálculo por esfera média da Terra; não representa levantamento de precisão.
        </small>
      </section>
    </>
  );
}
