import {
  IP_GEOLOCATION_SAVED_ACTION,
  parseIpGeolocationActivity,
} from './ip-geolocation-activities';
import {
  mapMarkerActivityEventType,
  markerOutputFromActivity,
  removedMarkerId,
} from './map-marker-activities';

import type {
  CaseActivity,
} from '../../../shared/cases/cases.types';
import type {
  IpGeolocationResult,
} from './ip-geolocation.types';
import type {
  GeographicMarker,
  MapMarkerColor,
} from './map-workspace.types';
import type {
  MapMarkerActivityEventType,
} from './map-marker-activities';

export type GeographicTimelineEventType =
  | MapMarkerActivityEventType
  | 'ip-saved';

type GeographicTimelineEventBase = {
  activityId: string;
  caseId: string;
  occurredAt: string;
  title: string;
};

export type GeographicTimelineMarkerEvent =
  GeographicTimelineEventBase & {
    kind: 'marker';
    marker: GeographicMarker;
    type: MapMarkerActivityEventType;
  };

export type GeographicTimelineIpEvent =
  GeographicTimelineEventBase & {
    kind: 'ip-geolocation';
    result: IpGeolocationResult;
    type: 'ip-saved';
  };

export type GeographicTimelineEvent =
  | GeographicTimelineMarkerEvent
  | GeographicTimelineIpEvent;

export type GeographicTimelineLocation = {
  id: string;
  name: string;
  category: string;
  color: MapMarkerColor;
  latitude: number;
  longitude: number;
};

export const GEOGRAPHIC_TIMELINE_EVENT_LABELS:
  Record<
    GeographicTimelineEventType,
    string
  > = {
    saved: 'Criação',
    updated: 'Atualização',
    removed: 'Remoção',
    'ip-saved': 'IP salvo',
  };

export function getGeographicTimelineLocation(
  event: GeographicTimelineEvent,
): GeographicTimelineLocation {
  if (event.kind === 'marker') {
    return {
      id: event.marker.id,
      name: event.marker.name,
      category: event.marker.category,
      color: event.marker.color,
      latitude: event.marker.latitude,
      longitude: event.marker.longitude,
    };
  }

  return {
    id: event.result.id,
    name: event.result.ip,
    category:
      'IP Intelligence · localização aproximada',
    color: event.result.color,
    latitude: event.result.latitude,
    longitude: event.result.longitude,
  };
}

function eventTypeFromActivity(
  activity: CaseActivity,
): GeographicTimelineEventType | null {
  const markerType =
    mapMarkerActivityEventType(
      activity,
    );

  if (markerType) {
    return markerType;
  }

  return (
    activity.moduleId ===
      'map-workspace' &&
    activity.action ===
      IP_GEOLOCATION_SAVED_ACTION
  )
    ? 'ip-saved'
    : null;
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
            eventTypeFromActivity(
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

    if (type === 'ip-saved') {
      const result =
        parseIpGeolocationActivity(
          activity,
        );

      if (result) {
        events.push({
          activityId: activity.id,
          caseId: activity.caseId,
          kind: 'ip-geolocation',
          occurredAt: activity.createdAt,
          result,
          title: activity.title,
          type,
        });
      }

      continue;
    }

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
        kind: 'marker',
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
      kind: 'marker',
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
    new Map<string, GeographicMarker>();

  for (const event of events) {
    if (event.kind !== 'marker') {
      continue;
    }

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

export function buildPersistentIpResultsFromEvents(
  events: GeographicTimelineEvent[],
): IpGeolocationResult[] {
  const results =
    new Map<string, IpGeolocationResult>();

  for (const event of events) {
    if (event.kind === 'ip-geolocation') {
      results.set(
        event.result.id,
        event.result,
      );
    }
  }

  return [...results.values()]
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) -
        Date.parse(left.createdAt),
    );
}
