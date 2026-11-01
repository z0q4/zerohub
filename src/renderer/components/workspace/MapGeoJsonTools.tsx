import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  FeatureCollection,
  Geometry,
  Point,
} from 'geojson';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
} from 'maplibre-gl';
import {
  MAX_GEOJSON_BYTES,
  previewGeoJson,
} from './geojson-import';
import {
  useScopedWorkspaceState,
} from './useScopedWorkspaceState';
import { featureCollectionBounds } from './location-boundaries';
import type {
  GeoJsonImportPreview,
} from './geojson-import';

type MapGeoJsonToolsProps = {
  activeCaseName: string | null;
  exportData: FeatureCollection;
  map: MapLibreMap | null;
  scopeId: string;
  visible: boolean;

  onCountChange(count: number): void;
  onBoundsChange(bounds: [[number, number], [number, number]] | null): void;
  onSaveToCase?(
    data: FeatureCollection,
  ): Promise<void>;
};

type ExportKind =
  | 'marker'
  | 'ip-geolocation'
  | 'geographic-search'
  | 'imported';

const EXPORT_KIND_OPTIONS: Array<{
  id: ExportKind;
  label: string;
}> = [
  { id: 'marker', label: 'Marcadores' },
  { id: 'ip-geolocation', label: 'IPs' },
  { id: 'geographic-search', label: 'Busca' },
  { id: 'imported', label: 'Importados' },
];

const POINT_SOURCE_ID = 'imported-geojson-points';
const SHAPE_SOURCE_ID = 'imported-geojson-shapes';
const LAYER_IDS = [
  'imported-geojson-cluster-count',
  'imported-geojson-clusters',
  'imported-geojson-points',
  'imported-geojson-lines',
  'imported-geojson-fills',
];

const EMPTY_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export function MapGeoJsonTools({
  activeCaseName,
  exportData,
  map,
  onCountChange,
  onBoundsChange,
  onSaveToCase,
  scopeId,
  visible,
}: MapGeoJsonToolsProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] =
    useScopedWorkspaceState(
      scopeId,
      '',
    );
  const [preview, setPreview] =
    useScopedWorkspaceState<
      GeoJsonImportPreview | null
    >(
      scopeId,
      null,
    );
  const [imported, setImported] =
    useScopedWorkspaceState<
      FeatureCollection
    >(
      scopeId,
      EMPTY_COLLECTION,
    );
  const [feedback, setFeedback] =
    useScopedWorkspaceState<
      string | null
    >(scopeId, null);
  const [exportKinds, setExportKinds] =
    useScopedWorkspaceState<ExportKind[]>(
      scopeId,
      EXPORT_KIND_OPTIONS.map((option) => option.id),
    );
  useEffect(() => {
    onBoundsChange(featureCollectionBounds(imported));
  }, [imported, onBoundsChange]);
  const [saving, setSaving] = useState(false);
  const pointData = useMemo(
    (): FeatureCollection<Point> => ({
      type: 'FeatureCollection',
      features: imported.features.filter(
        (
          feature,
        ): feature is typeof feature & {
          geometry: Point;
        } => feature.geometry.type === 'Point',
      ),
    }),
    [imported],
  );
  const shapeData = useMemo(
    (): FeatureCollection<Geometry> => ({
      type: 'FeatureCollection',
      features: imported.features.filter(
        (feature) =>
          feature.geometry.type !== 'Point',
      ),
    }),
    [imported],
  );
  const visiblePointData = visible
    ? pointData
    : EMPTY_COLLECTION;
  const visibleShapeData = visible
    ? shapeData
    : EMPTY_COLLECTION;
  const visibleDataRef = useRef({ points: visiblePointData, shapes: visibleShapeData });
  visibleDataRef.current = { points: visiblePointData, shapes: visibleShapeData };
  const selectedExportData = useMemo(
    (): FeatureCollection => ({
      type: 'FeatureCollection',
      features: [
        ...exportData.features.filter((feature) => {
          const kind = feature.properties?.kind;

          return typeof kind === 'string' &&
            exportKinds.includes(kind as ExportKind);
        }),
        ...(exportKinds.includes('imported')
          ? imported.features
          : []),
      ],
    }),
    [exportData, exportKinds, imported.features],
  );

  useEffect(() => {
    onCountChange(
      imported.features.length,
    );
  }, [
    imported.features.length,
    onCountChange,
  ]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const handleClusterClick = async (
      event: { features?: Array<{
        properties: Record<string, unknown> | null;
        geometry: Geometry;
      }> },
    ) => {
      const feature = event.features?.[0];
      const clusterId = Number(
        feature?.properties?.cluster_id,
      );

      if (
        !feature ||
        feature.geometry.type !== 'Point' ||
        !Number.isInteger(clusterId)
      ) {
        return;
      }

      const source = map.getSource(
        POINT_SOURCE_ID,
      ) as GeoJSONSource | undefined;

      try {
        const zoom = await source
          ?.getClusterExpansionZoom(
            clusterId,
          );
        if (zoom !== undefined) {
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
          });
        }
      } catch {
        setFeedback(
          'Não foi possível expandir o cluster.',
        );
      }
    };
    const cleanup = () => {
      try {
        map.off(
          'click',
          'imported-geojson-clusters',
          handleClusterClick,
        );
        for (const id of LAYER_IDS) {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
        }
        for (const id of [
          POINT_SOURCE_ID,
          SHAPE_SOURCE_ID,
        ]) {
          if (map.getSource(id)) {
            map.removeSource(id);
          }
        }
      } catch {
        // O mapa pode ter sido desmontado.
      }
    };

    const mount = () => {
      cleanup();
      try {
        map.addSource(POINT_SOURCE_ID, {
          type: 'geojson',
          data: visibleDataRef.current.points,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 46,
        });
        map.addSource(SHAPE_SOURCE_ID, {
          type: 'geojson',
          data: visibleDataRef.current.shapes,
        });
        map.addLayer({
          id: 'imported-geojson-fills',
          type: 'fill',
          source: SHAPE_SOURCE_ID,
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': '#b77cff',
            'fill-opacity': 0.16,
          },
        });
        map.addLayer({
          id: 'imported-geojson-lines',
          type: 'line',
          source: SHAPE_SOURCE_ID,
          paint: {
            'line-color': '#b77cff',
            'line-width': 2,
          },
        });
        map.addLayer({
          id: 'imported-geojson-points',
          type: 'circle',
          source: POINT_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#b77cff',
            'circle-radius': 6,
            'circle-stroke-color': '#f1e8ff',
            'circle-stroke-width': 1,
          },
        });
        map.addLayer({
          id: 'imported-geojson-clusters',
          type: 'circle',
          source: POINT_SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#52e5ff',
              20,
              '#ffe45c',
              75,
              '#ff5d68',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              14,
              20,
              18,
              75,
              23,
            ],
          },
        });
        map.addLayer({
          id: 'imported-geojson-cluster-count',
          type: 'symbol',
          source: POINT_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 10,
          },
          paint: {
            'text-color': '#050505',
          },
        });
        map.on(
          'click',
          'imported-geojson-clusters',
          handleClusterClick,
        );
      } catch (unknownError) {
        console.error(
          '[GeoJSON] Falha ao montar camadas.',
          unknownError,
        );
        cleanup();
      }
    };
    map.on('style.load', mount);
    mount();

    return () => { map.off('style.load', mount); cleanup(); };
  }, [map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    try {
      (map.getSource(
        POINT_SOURCE_ID,
      ) as GeoJSONSource | undefined)
        ?.setData(visiblePointData);
      (map.getSource(
        SHAPE_SOURCE_ID,
      ) as GeoJSONSource | undefined)
        ?.setData(visibleShapeData);
    } catch {
      // Atualização tardia após desmontagem.
    }
  }, [
    map,
    visiblePointData,
    visibleShapeData,
  ]);

  const runPreview = useCallback(() => {
    const nextPreview = previewGeoJson(text);
    setPreview(nextPreview);
    setFeedback(
      nextPreview.accepted.length > 0
        ? 'Preview pronto; confirme para importar.'
        : nextPreview.warnings[0] ??
          'Nenhum item aceito.',
    );
  }, [text]);

  const copyExport = useCallback(() => {
    void window.zeroHub.clipboard
      .writeText(
        JSON.stringify(selectedExportData, null, 2),
      )
      .then(() => setFeedback(
        'GeoJSON do mapa copiado.',
      ))
      .catch(() => setFeedback(
        'Não foi possível copiar.',
      ));
  }, [selectedExportData]);

  const copyCsvExport = useCallback(() => {
    const escape = (value: unknown): string => {
      const textValue = value === null || value === undefined
        ? ''
        : String(value);

      return `"${textValue.replaceAll('"', '""')}"`;
    };
    const rows = selectedExportData.features.flatMap((feature) => {
      if (feature.geometry.type !== 'Point') {
        return [];
      }

      return [[
        feature.properties?.kind ?? 'point',
        feature.properties?.name ?? feature.properties?.ip ?? '',
        feature.geometry.coordinates[1],
        feature.geometry.coordinates[0],
      ].map(escape).join(',')];
    });
    const csv = [
      'kind,label,latitude,longitude',
      ...rows,
    ].join('\n');

    void window.zeroHub.clipboard.writeText(csv)
      .then(() => setFeedback(
        `${rows.length} ponto(s) copiado(s) em CSV.`,
      ))
      .catch(() => setFeedback(
        'Não foi possível copiar o CSV.',
      ));
  }, [selectedExportData]);

  const downloadExport = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify(selectedExportData, null, 2)],
      { type: 'application/geo+json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zerohub-map.geojson';
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback('Download iniciado.');
  }, [selectedExportData]);

  const saveImportedToCase = useCallback(async () => {
    if (
      !activeCaseName ||
      !onSaveToCase ||
      imported.features.length === 0 ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await onSaveToCase(imported);
      setFeedback(
        `Importação registrada em ${activeCaseName}.`,
      );
    } catch {
      setFeedback(
        'Não foi possível registrar a importação no case.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    activeCaseName,
    imported,
    onSaveToCase,
    saving,
  ]);

  return (
    <>
      <button
        className="mapGeoJsonToggle"
        type="button"
        aria-controls="map-geojson-panel"
        aria-expanded={open}
        aria-label="Importar ou exportar GeoJSON"
        onClick={() => setOpen(
          (current) => !current,
        )}
      >
        JSON
      </button>

      <section
        id="map-geojson-panel"
        className="mapGeoJsonPanel"
        hidden={!open}
        aria-label="Importação e exportação GeoJSON"
      >
        <header>
          <div>
            <span>DADOS</span>
            <strong>GeoJSON seguro</strong>
          </div>
          <button
            type="button"
            aria-label="Fechar GeoJSON"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>

        <label>
          Arquivo local
          <input
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              if (file.size > MAX_GEOJSON_BYTES) {
                setFeedback(
                  'O arquivo excede 1 MiB.',
                );
                return;
              }
              void file.text().then(setText)
                .catch(() => setFeedback(
                  'Não foi possível ler o arquivo.',
                ));
            }}
          />
        </label>

        <textarea
          value={text}
          maxLength={MAX_GEOJSON_BYTES}
          aria-label="Conteúdo GeoJSON"
          placeholder="Cole Feature, FeatureCollection, Point, LineString ou Polygon"
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
          }}
        />

        {preview && (
          <div className="mapGeoJsonPreview" role="status">
            <strong>
              {preview.accepted.length} aceito(s)
            </strong>
            <span>
              {preview.rejected} rejeitado(s)
            </span>
            {preview.warnings.map(
              (warning) => (
                <small key={warning}>{warning}</small>
              ),
            )}
          </div>
        )}

        <fieldset className="mapGeoJsonExportKinds">
          <legend>Exportar</legend>
          {EXPORT_KIND_OPTIONS.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={exportKinds.includes(option.id)}
                onChange={(event) => {
                  setExportKinds((current) => event.target.checked
                    ? [...new Set([...current, option.id])]
                    : current.filter((kind) => kind !== option.id));
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="mapGeoJsonActions">
          <button type="button" onClick={runPreview}>
            Validar preview
          </button>
          <button
            type="button"
            disabled={!preview?.accepted.length}
            onClick={() => {
              if (!preview) {
                return;
              }
              setImported({
                type: 'FeatureCollection',
                features: preview.accepted,
              });
              setFeedback('Importação transitória aplicada.');
            }}
          >
            Importar
          </button>
          <button
            type="button"
            disabled={selectedExportData.features.length === 0}
            onClick={copyExport}
          >
            Copiar mapa
          </button>
          <button
            type="button"
            disabled={selectedExportData.features.length === 0}
            onClick={copyCsvExport}
          >
            Copiar CSV
          </button>
          <button
            type="button"
            disabled={selectedExportData.features.length === 0}
            onClick={downloadExport}
          >
            Baixar mapa
          </button>
          <button
            type="button"
            disabled={
              saving ||
              imported.features.length === 0 ||
              !activeCaseName
            }
            onClick={() => {
              void saveImportedToCase();
            }}
          >
            {saving ? 'Salvando…' : 'Salvar no case'}
          </button>
          <button
            type="button"
            onClick={() => {
              setImported(EMPTY_COLLECTION);
              setPreview(null);
              setText('');
              setFeedback('Importação limpa.');
            }}
          >
            Limpar importação
          </button>
        </div>

        <p aria-live="polite">
          {feedback ?? 'Nada é importado antes da confirmação.'}
        </p>
        <small>
          Limite: 1 MiB e 500 features. Dados importados são transitórios.
        </small>
      </section>
    </>
  );
}
