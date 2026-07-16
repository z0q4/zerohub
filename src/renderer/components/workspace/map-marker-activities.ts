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

export type GeographicTimelineEventType =
  | 'saved'
  | 'updated'
  | 'removed';

export type GeographicTimelineEvent = {
  activityId: string;
  caseId: string;
  marker: GeographicMarker;
  occurredAt: string;
  title: string;
  type: GeographicTimelineEventType;
};

export const GEOGRAPHIC_TIMELINE_EVENT_LABELS:
  Record<
    GeographicTimelineEventType,
    string
  > = {
    saved: 'Criação',
    updated: 'Atualização',
    removed: 'Remoção',
  };

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

function markerOutputFromActivity(
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

function removedMarkerId(
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

function geographicTimelineEventType(
  activity: CaseActivity,
): GeographicTimelineEventType | null {
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

export function buildGeographicTimelineEvents(
  activities: CaseActivity[],
): GeographicTimelineEvent[] {
  const markerState =
    new Map<string, GeographicMarker>();
  const events:
    GeographicTimelineEvent[] = [];
  const chronologicalActivities =
    activities
      .map(
        (activity, sourceIndex) => ({
          activity,
          sourceIndex,
          timestamp:
            Date.parse(
              activity.createdAt,
            ),
          type:
            geographicTimelineEventType(
              activity,
            ),
        }),
      )
      .filter(
        (
          entry,
        ): entry is typeof entry & {
          type: GeographicTimelineEventType;
        } =>
          entry.type !== null &&
          Number.isFinite(
            entry.timestamp,
          ),
      )
      .sort(
        (left, right) =>
          left.timestamp -
            right.timestamp ||
          right.sourceIndex -
            left.sourceIndex,
      );

  for (
    const entry of
    chronologicalActivities
  ) {
    const {
      activity,
      type,
    } = entry;

    if (type === 'removed') {
      const markerId =
        removedMarkerId(activity);
      const currentMarker = markerId
        ? markerState.get(markerId)
        : null;

      if (!currentMarker) {
        continue;
      }

      events.push({
        activityId: activity.id,
        caseId: activity.caseId,
        marker: {
          ...currentMarker,
          activityId: activity.id,
        },
        occurredAt: activity.createdAt,
        title: activity.title,
        type,
      });
      markerState.delete(
        currentMarker.id,
      );
      continue;
    }

    const output =
      markerOutputFromActivity(
        activity,
      );

    if (
      !output ||
      (
        type === 'updated' &&
        !markerState.has(output.id)
      )
    ) {
      continue;
    }

    const marker:
      GeographicMarker = {
      ...output,
      activityId: activity.id,
      saved: true,
      caseId: activity.caseId,
      source: 'saved',
    };

    markerState.set(
      marker.id,
      marker,
    );
    events.push({
      activityId: activity.id,
      caseId: activity.caseId,
      marker,
      occurredAt: activity.createdAt,
      title: activity.title,
      type,
    });
  }

  return events;
}

export function buildPersistentMapMarkersFromEvents(
  events: GeographicTimelineEvent[],
): GeographicMarker[] {
  const markers =
    new Map<
      string,
      GeographicMarker
    >();

  for (const event of events) {
    if (event.type === 'removed') {
      markers.delete(event.marker.id);
    } else {
      markers.set(
        event.marker.id,
        event.marker,
      );
    }
  }

  return [...markers.values()]
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) -
        Date.parse(left.createdAt),
    );
}

export function buildPersistentMapMarkers(
  activities: CaseActivity[],
): GeographicMarker[] {
  return buildPersistentMapMarkersFromEvents(
    buildGeographicTimelineEvents(
      activities,
    ),
  );
}
