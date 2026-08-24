import {
  MAP_MARKER_CATEGORIES,
  MAP_MARKER_COLORS,
} from './map-workspace.types';

import type {
  CaseActivity,
  CaseActivityCreateInput,
} from '../../../shared/cases/cases.types';
import type {
  GeographicMarker,
  MapMarkerCategory,
  MapMarkerColor,
  MapMarkerDetailsUpdate,
} from './map-workspace.types';

export const MAP_MARKER_ACTIVITY_ACTIONS = {
  removed: 'map-marker-removed',
  saved: 'map-marker-saved',
  updated: 'map-marker-updated',
} as const;

export type MapMarkerActivityOutput = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  category: MapMarkerCategory;
  color: MapMarkerColor;
  createdAt: string;
};

export type MapMarkerActivityEventType =
  | 'saved'
  | 'updated'
  | 'removed';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isMapMarkerCategory(
  value: unknown,
): value is MapMarkerCategory {
  return (
    typeof value === 'string' &&
    MAP_MARKER_CATEGORIES.includes(
      value as MapMarkerCategory,
    )
  );
}

export function isMapMarkerColor(
  value: unknown,
): value is MapMarkerColor {
  return (
    typeof value === 'string' &&
    MAP_MARKER_COLORS.some(
      (preset) =>
        preset.id === value,
    )
  );
}

export function isValidMarkerCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function markerOutputFromActivity(
  activity: CaseActivity,
): MapMarkerActivityOutput | null {
  if (!isRecord(activity.output)) {
    return null;
  }

  const {
    id,
    latitude,
    longitude,
    name,
    category,
    color,
    createdAt,
  } = activity.output;

  if (
    typeof id !== 'string' ||
    !id.trim() ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !isValidMarkerCoordinates(
      latitude,
      longitude,
    ) ||
    typeof name !== 'string' ||
    !name.trim() ||
    !isMapMarkerCategory(category) ||
    !isMapMarkerColor(color) ||
    typeof createdAt !== 'string' ||
    !createdAt ||
    !Number.isFinite(
      Date.parse(createdAt),
    )
  ) {
    return null;
  }

  return {
    id,
    latitude,
    longitude,
    name: name.trim(),
    category,
    color,
    createdAt,
  };
}

export function removedMarkerId(
  activity: CaseActivity,
): string | null {
  if (!isRecord(activity.output)) {
    return null;
  }

  const markerId =
    activity.output.markerId;

  return (
    typeof markerId === 'string' &&
    markerId.trim()
  )
    ? markerId
    : null;
}

export function normalizeMapMarkerDetails(
  marker: GeographicMarker,
  update: MapMarkerDetailsUpdate = marker,
): MapMarkerActivityOutput {
  const name = update.name.trim();

  if (!name) {
    throw new Error(
      'Informe um nome para o marcador.',
    );
  }

  if (
    !isValidMarkerCoordinates(
      marker.latitude,
      marker.longitude,
    )
  ) {
    throw new Error(
      'As coordenadas do marcador são inválidas.',
    );
  }

  if (
    !isMapMarkerCategory(
      update.category,
    ) ||
    !isMapMarkerColor(update.color)
  ) {
    throw new Error(
      'Selecione categoria e cor válidas.',
    );
  }

  return {
    id: marker.id,
    latitude: marker.latitude,
    longitude: marker.longitude,
    name,
    category: update.category,
    color: update.color,
    createdAt: marker.createdAt,
  };
}

export function createMapMarkerSavedActivity(
  caseId: string,
  marker: GeographicMarker,
): CaseActivityCreateInput {
  const output =
    normalizeMapMarkerDetails(marker);

  return {
    caseId,
    moduleId: 'map-workspace',
    action:
      MAP_MARKER_ACTIVITY_ACTIONS.saved,
    title:
      `Marcador geográfico: ${output.name}`,
    status: 'success',
    output,
  };
}

export function createMapMarkerUpdatedActivity(
  caseId: string,
  marker: GeographicMarker,
  update: MapMarkerDetailsUpdate,
): CaseActivityCreateInput {
  const input =
    normalizeMapMarkerDetails(marker);
  const output =
    normalizeMapMarkerDetails(
      marker,
      update,
    );

  return {
    caseId,
    moduleId: 'map-workspace',
    action:
      MAP_MARKER_ACTIVITY_ACTIONS.updated,
    title:
      `Marcador atualizado: ${output.name}`,
    status: 'success',
    input,
    output,
  };
}

export function createMapMarkerRemovedActivity(
  caseId: string,
  marker: GeographicMarker,
): CaseActivityCreateInput {
  const input =
    normalizeMapMarkerDetails(marker);

  return {
    caseId,
    moduleId: 'map-workspace',
    action:
      MAP_MARKER_ACTIVITY_ACTIONS.removed,
    title:
      `Marcador removido: ${input.name}`,
    status: 'info',
    input,
    output: {
      markerId: marker.id,
    },
  };
}

export function mapMarkerActivityEventType(
  activity: CaseActivity,
): MapMarkerActivityEventType | null {
  if (
    activity.moduleId !==
    'map-workspace'
  ) {
    return null;
  }

  if (
    activity.action ===
    MAP_MARKER_ACTIVITY_ACTIONS.saved
  ) {
    return 'saved';
  }

  if (
    activity.action ===
    MAP_MARKER_ACTIVITY_ACTIONS.updated
  ) {
    return 'updated';
  }

  if (
    activity.action ===
    MAP_MARKER_ACTIVITY_ACTIONS.removed
  ) {
    return 'removed';
  }

  return null;
}
