import {
  useCallback,
  useMemo,
} from 'react';

import {
  MAP_MARKER_CATEGORIES,
} from './map-workspace.types';

import type {
  Dispatch,
  SetStateAction,
} from 'react';
import type {
  GeographicMarker,
  MapLayerColorFilter,
  MapMarkerCategory,
  MapWorkspaceViewState,
} from './map-workspace.types';

type MapMarkerLayers = {
  visibleMarkers: GeographicMarker[];

  changeColorFilter(
    color: MapLayerColorFilter,
  ): void;

  closeLayerManager(): void;

  hideAllLayers(): void;

  setOperationalHudOpen(
    open: boolean,
  ): void;

  showAllLayers(): void;

  toggleCategory(
    category: MapMarkerCategory,
  ): void;

  toggleLayerManager(): void;
};

export function useMapMarkerLayers(
  markers: GeographicMarker[],
  viewState: MapWorkspaceViewState,
  setViewState: Dispatch<
    SetStateAction<
      MapWorkspaceViewState
    >
  >,
): MapMarkerLayers {
  const hiddenCategorySet =
    useMemo(
      () =>
        new Set(
          viewState
            .hiddenMarkerCategories,
        ),
      [
        viewState
          .hiddenMarkerCategories,
      ],
    );
  const visibleMarkers =
    useMemo(
      () =>
        markers.filter(
          (marker) =>
            !hiddenCategorySet.has(
              marker.category,
            ) &&
            (
              viewState
                .markerColorFilter ===
                'all' ||
              marker.color ===
                viewState
                  .markerColorFilter
            ),
        ),
      [
        hiddenCategorySet,
        markers,
        viewState.markerColorFilter,
      ],
    );
  const closeLayerManager =
    useCallback(() => {
      setViewState(
        (current) => ({
          ...current,
          layerManagerOpen: false,
        }),
      );
    }, [setViewState]);
  const toggleLayerManager =
    useCallback(() => {
      setViewState(
        (current) => ({
          ...current,
          layerManagerOpen:
            !current.layerManagerOpen,
        }),
      );
    }, [setViewState]);
  const changeColorFilter =
    useCallback(
      (
        color:
          MapLayerColorFilter,
      ) => {
        setViewState(
          (current) => ({
            ...current,
            markerColorFilter: color,
          }),
        );
      },
      [setViewState],
    );
  const showAllLayers =
    useCallback(() => {
      setViewState(
        (current) => ({
          ...current,
          hiddenMarkerCategories: [],
          markerColorFilter: 'all',
        }),
      );
    }, [setViewState]);
  const hideAllLayers =
    useCallback(() => {
      setViewState(
        (current) => ({
          ...current,
          hiddenMarkerCategories: [
            ...MAP_MARKER_CATEGORIES,
          ],
        }),
      );
    }, [setViewState]);
  const toggleCategory =
    useCallback(
      (
        category:
          MapMarkerCategory,
      ) => {
        setViewState(
          (current) => {
            const hidden = new Set(
              current
                .hiddenMarkerCategories,
            );

            if (hidden.has(category)) {
              hidden.delete(category);
            } else {
              hidden.add(category);
            }

            return {
              ...current,
              hiddenMarkerCategories:
                MAP_MARKER_CATEGORIES
                  .filter(
                    (item) =>
                      hidden.has(item),
                  ),
            };
          },
        );
      },
      [setViewState],
    );
  const setOperationalHudOpen =
    useCallback(
      (open: boolean) => {
        setViewState(
          (current) => ({
            ...current,
            operationalHudOpen: open,
          }),
        );
      },
      [setViewState],
    );

  return {
    changeColorFilter,
    closeLayerManager,
    hideAllLayers,
    setOperationalHudOpen,
    showAllLayers,
    toggleCategory,
    toggleLayerManager,
    visibleMarkers,
  };
}
