import {
  memo,
  useMemo,
  useState,
} from 'react';
import type { VisualLayerId, VisualLayerSettings } from './map-layer-presentation';

import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
} from './map-workspace.types';

import type {
  IpGeolocationResult,
} from './ip-geolocation.types';
import type {
  GeographicMarker,
  MapLayerColorFilter,
  MapMarkerCategory,
  MapOperationalLayerId,
} from './map-workspace.types';

export type MapOperationalLayerSummary = {
  detail: string;
  id: MapOperationalLayerId;
  label: string;
  total: number;
  status?: { kind: 'loading' | 'error'; message: string };
};

type MapLayerManagerProps = {
  colorFilter: MapLayerColorFilter;
  hiddenCategories:
    MapMarkerCategory[];
  hiddenOperationalLayers:
    MapOperationalLayerId[];
  ipIntelligenceVisible: boolean;
  ipResults: IpGeolocationResult[];
  markers: GeographicMarker[];
  operationalLayers:
    MapOperationalLayerSummary[];
  visualSettings: VisualLayerSettings;
  zoomableLayers: VisualLayerId[];
  open: boolean;

  onClose(): void;

  onColorFilterChange(
    color: MapLayerColorFilter,
  ): void;

  onHideAll(): void;

  onShowAll(): void;

  onToggleCategory(
    category: MapMarkerCategory,
  ): void;

  onToggleIpIntelligence(): void;

  onToggleOperationalLayer(
    layerId: MapOperationalLayerId,
  ): void;
  onOpacityChange(layer: VisualLayerId, opacity: number): void;
  onMoveLayer(layer: VisualLayerId, direction: -1 | 1): void;
  onZoomLayer(layer: VisualLayerId): void;
};

type CategorySummary = {
  persisted: number;
  total: number;
  transient: number;
};

const EMPTY_SUMMARY:
  CategorySummary = {
    persisted: 0,
    total: 0,
    transient: 0,
  };

export const MapLayerManager = memo(
  function MapLayerManager({
    colorFilter,
    hiddenCategories,
    hiddenOperationalLayers,
    ipIntelligenceVisible,
    ipResults,
    markers,
    onClose,
    onColorFilterChange,
    onHideAll,
    onShowAll,
    onToggleCategory,
    onToggleIpIntelligence,
    onToggleOperationalLayer,
    onOpacityChange,
    onMoveLayer,
    onZoomLayer,
    open,
    operationalLayers,
    visualSettings,
    zoomableLayers,
  }: MapLayerManagerProps) {
    const [search, setSearch] = useState('');
    const matches = (label: string) => label.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
    const categorySummaries =
      useMemo(() => {
        const summaries = new Map<
          MapMarkerCategory,
          CategorySummary
        >();

        for (
          const category of
          MAP_MARKER_CATEGORIES
        ) {
          summaries.set(category, {
            ...EMPTY_SUMMARY,
          });
        }

        for (const marker of markers) {
          const summary =
            summaries.get(
              marker.category,
            );

          if (!summary) {
            continue;
          }

          summary.total += 1;

          if (marker.saved) {
            summary.persisted += 1;
          } else {
            summary.transient += 1;
          }
        }

        return summaries;
      }, [markers]);
    const hiddenCategorySet =
      useMemo(
        () =>
          new Set(
            hiddenCategories,
          ),
        [hiddenCategories],
      );
    const ipSummary = useMemo(
      () => ({
        persisted:
          ipResults.filter(
            (result) => result.saved,
          ).length,
        total: ipResults.length,
        transient:
          ipResults.filter(
            (result) => !result.saved,
          ).length,
      }),
      [ipResults],
    );
    const hiddenOperationalLayerSet =
      useMemo(
        () => new Set(
          hiddenOperationalLayers,
        ),
        [hiddenOperationalLayers],
      );
    const orderedLayers = useMemo(() => {
      const visual = visualSettings.order.flatMap((id) => operationalLayers.filter((layer) => layer.id === id));
      return [...visual, ...operationalLayers.filter((layer) => !visualSettings.order.includes(layer.id as VisualLayerId))];
    }, [operationalLayers, visualSettings.order]);
    const visibleGroups = operationalLayers.filter((layer) => layer.total > 0 && !hiddenOperationalLayerSet.has(layer.id)).length + MAP_MARKER_CATEGORIES.filter((category) => (categorySummaries.get(category)?.total ?? 0) > 0 && !hiddenCategorySet.has(category)).length + (ipSummary.total > 0 && ipIntelligenceVisible ? 1 : 0);
    const markerLegend = useMemo(() => MAP_MARKER_COLORS.map((color) => ({ ...color, total: markers.filter((marker) => marker.color === color.id).length })).filter((color) => color.total > 0), [markers]);

    return (
      <section
        className="mapLayerManager"
        hidden={!open}
        id="map-layer-manager"
        aria-label="Gerenciador de camadas do mapa"
      >
        <header>
          <div>
            <span>CAMADAS</span>
            <strong>
              Objetos e camadas
            </strong>
          </div>

          <button
            type="button"
            aria-label="Minimizar gerenciador de camadas"
            onClick={onClose}
          >
            —
          </button>
        </header>

        <p className="mapLayerSummary">{visibleGroups} {visibleGroups === 1 ? 'grupo visível' : 'grupos visíveis'} com dados</p>
        <label className="mapLayerSearch"><span className="srOnly">Pesquisar camadas e categorias</span><input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Pesquisar camadas e categorias" /></label>

        <div className="mapLayerBulkActions">
          <button
            type="button"
            onClick={onShowAll}
          >
            Mostrar todos
          </button>

          <button
            type="button"
            onClick={onHideAll}
          >
            Ocultar todos
          </button>
        </div>

        <label className="mapLayerColorFilter">
          <span>Filtrar por cor</span>

          <select
            value={colorFilter}
            onChange={(event) => {
              onColorFilterChange(
                event.target.value as
                  MapLayerColorFilter,
              );
            }}
          >
            <option value="all">
              Todas as cores
            </option>

            {MAP_MARKER_COLORS.map(
              (color) => (
                <option
                  key={color.id}
                  value={color.id}
                >
                  {color.label}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="mapLayerCategoryList">
          <details className="mapLayerSection" open>
          <summary>Camadas operacionais <span>{operationalLayers.length}</span></summary>
          {orderedLayers.filter((layer) => matches(layer.label)).map(
            (layer) => {
              const visible =
                !hiddenOperationalLayerSet
                  .has(layer.id);

              return (
                <div className="mapLayerRow" key={layer.id}>
                <button
                  type="button"
                  className="mapLayerCategory isOperational"
                  aria-pressed={visible}
                  onClick={() => {
                    onToggleOperationalLayer(
                      layer.id,
                    );
                  }}
                >
                  <span
                    className="mapLayerVisibility"
                    aria-hidden="true"
                  >
                    {visible ? '●' : '○'}
                  </span>

                  <span className="mapLayerCategoryName">
                    {layer.label}
                  </span>

                  <strong>
                    {layer.total}
                  </strong>

                  <small>
                    {layer.detail}
                  </small>
                </button>
                {layer.status && <small className="mapLayerStatus" data-kind={layer.status.kind} role="status">{layer.status.message}</small>}
                {(layer.id === 'imported-geojson' || layer.id === 'location-selection') && (() => {
                  const id: VisualLayerId = layer.id;
                  const index = visualSettings.order.indexOf(id);
                  return <details className="mapLayerDetails">
                    <summary>Estilo e posição</summary>
                    <label>Opacidade <output>{Math.round(visualSettings.opacity[id] * 100)}%</output><input aria-label={`Opacidade: ${layer.label}`} type="range" min="0" max="100" value={Math.round(visualSettings.opacity[id] * 100)} onChange={(event) => onOpacityChange(id, Number(event.currentTarget.value) / 100)} /></label>
                    <div className="mapLayerDetailActions">
                      <button type="button" disabled={index === 0} onClick={() => onMoveLayer(id, -1)} aria-label={`Enviar ${layer.label} para baixo`}>↓</button>
                      <button type="button" disabled={index === visualSettings.order.length - 1} onClick={() => onMoveLayer(id, 1)} aria-label={`Trazer ${layer.label} para cima`}>↑</button>
                      <button type="button" disabled={!visible || !zoomableLayers.includes(id)} onClick={() => onZoomLayer(id)}>Aproximar</button>
                    </div>
                    <small>{id === 'location-selection' ? 'Natural Earth · IBGE · Prefeitura do Recife' : 'Dados importados pelo usuário'}</small>
                  </details>;
                })()}
                </div>
              );
            },
          )}

          {orderedLayers.filter((layer) => matches(layer.label)).length === 0 && <p className="mapLayerEmpty">Nenhuma camada encontrada.</p>}
          </details>

          <details className="mapLayerSection" open>
          <summary>Objetos <span>{markers.length + ipSummary.total}</span></summary>
          {matches('IP Intelligence') && <button
            type="button"
            className="mapLayerCategory isIpIntelligence"
            aria-pressed={
              ipIntelligenceVisible
            }
            onClick={
              onToggleIpIntelligence
            }
          >
            <span
              className="mapLayerVisibility"
              aria-hidden="true"
            >
              {ipIntelligenceVisible
                ? '▲'
                : '△'}
            </span>

            <span className="mapLayerCategoryName">
              IP Intelligence
            </span>

            <strong>
              {ipSummary.total}
            </strong>

            <small>
              {ipSummary.persisted} P
              {' · '}
              {ipSummary.transient} T
            </small>
          </button>}

          {MAP_MARKER_CATEGORIES.filter(matches).map(
            (category) => {
              const summary =
                categorySummaries.get(
                  category,
                ) ?? EMPTY_SUMMARY;
              const categoryVisible =
                !hiddenCategorySet.has(
                  category,
                );

              return (
                <button
                  type="button"
                  className="mapLayerCategory"
                  key={category}
                  aria-pressed={
                    categoryVisible
                  }
                  onClick={() => {
                    onToggleCategory(
                      category,
                    );
                  }}
                >
                  <span
                    className="mapLayerVisibility"
                    aria-hidden="true"
                  >
                    {categoryVisible
                      ? '●'
                      : '○'}
                  </span>

                  <span className="mapLayerCategoryName">
                    {category}
                  </span>

                  <strong>
                    {summary.total}
                  </strong>

                  <small>
                    {summary.persisted} P
                    {' · '}
                    {summary.transient} T
                  </small>
                </button>
              );
            },
          )}
          {!matches('IP Intelligence') && !MAP_MARKER_CATEGORIES.some(matches) && <p className="mapLayerEmpty">Nenhuma categoria encontrada.</p>}
          </details>
        </div>

        <div className="mapLayerLegend">
          <span>P persistido · T transitório</span>
          {markerLegend.map((color) => <span key={color.id}><i style={{ backgroundColor: color.value }} aria-hidden="true" />{color.label}: {color.total}</span>)}
        </div>
      </section>
    );
  },
);
