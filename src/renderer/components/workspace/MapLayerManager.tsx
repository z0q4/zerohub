import {
  memo,
  useMemo,
} from 'react';

import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
} from './map-workspace.types';

import type {
  GeographicMarker,
  MapLayerColorFilter,
  MapMarkerCategory,
} from './map-workspace.types';

type MapLayerManagerProps = {
  colorFilter: MapLayerColorFilter;
  hiddenCategories:
    MapMarkerCategory[];
  markers: GeographicMarker[];
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
    markers,
    onClose,
    onColorFilterChange,
    onHideAll,
    onShowAll,
    onToggleCategory,
    open,
  }: MapLayerManagerProps) {
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
              Layer Manager
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

        <div
          className="mapLayerCategoryList"
          role="list"
        >
          {MAP_MARKER_CATEGORIES.map(
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
                  role="listitem"
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
        </div>

        <p className="mapLayerLegend">
          P persistido · T transitório
        </p>
      </section>
    );
  },
);
