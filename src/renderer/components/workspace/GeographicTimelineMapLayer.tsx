import {
  memo,
  useEffect,
  useRef,
} from 'react';
import maplibregl, {
  type Map as MapLibreMap,
} from 'maplibre-gl';

import {
  GEOGRAPHIC_TIMELINE_EVENT_LABELS,
  getGeographicTimelineLocation,
} from './geographic-timeline-activities';
import {
  getMapMarkerColorValue,
} from './map-workspace.types';

import type {
  GeographicTimelineEvent,
} from './geographic-timeline-activities';

type GeographicTimelineMapLayerProps = {
  event:
    GeographicTimelineEvent | null;
  map: MapLibreMap | null;
  selectionRevision: number;

  onCameraMotionChange(
    moving: boolean,
  ): void;
};

type PlaybackMarkerView = {
  element: HTMLDivElement;
  marker: maplibregl.Marker;
  metadata: HTMLElement;
  name: HTMLElement;
  status: HTMLElement;
  visible: boolean;
};

const PLAYBACK_CAMERA_DURATION_MS = 850;
const PLAYBACK_LOCATION_ZOOM = 5.6;

function createPlaybackMarkerView():
  PlaybackMarkerView {
  const element =
    document.createElement('div');
  const pulse =
    document.createElement('span');
  const core =
    document.createElement('span');
  const eventBadge =
    document.createElement('span');
  const tooltip =
    document.createElement('div');
  const name =
    document.createElement('strong');
  const metadata =
    document.createElement('span');
  const status =
    document.createElement('small');

  element.className =
    'geographicTimelineMarker';
  element.setAttribute('role', 'img');
  pulse.className =
    'geographicTimelineMarkerPulse';
  core.className =
    'geographicTimelineMarkerCore';
  eventBadge.className =
    'geographicTimelineMarkerBadge';
  tooltip.className =
    'geographicTimelineMarkerTooltip';
  tooltip.append(
    name,
    metadata,
    status,
  );
  element.append(
    pulse,
    core,
    eventBadge,
    tooltip,
  );

  return {
    element,
    marker:
      new maplibregl.Marker({
        anchor: 'center',
        element,
        opacityWhenCovered: 0,
        subpixelPositioning: true,
      }),
    metadata,
    name,
    status,
    visible: false,
  };
}

export const GeographicTimelineMapLayer =
  memo(
    function GeographicTimelineMapLayer({
      event,
      map,
      onCameraMotionChange,
      selectionRevision,
    }: GeographicTimelineMapLayerProps) {
      const viewRef =
        useRef<PlaybackMarkerView | null>(
          null,
        );

      useEffect(() => {
        if (!map) {
          return undefined;
        }

        const view =
          createPlaybackMarkerView();
        viewRef.current = view;

        return () => {
          view.marker.remove();
          viewRef.current = null;
        };
      }, [map]);

      useEffect(() => {
        const view = viewRef.current;

        if (!map || !view) {
          return undefined;
        }

        if (!event) {
          if (view.visible) {
            view.marker.remove();
            view.visible = false;
          }

          onCameraMotionChange(false);
          return undefined;
        }

        const { type } = event;
        const location =
          getGeographicTimelineLocation(
            event,
          );
        const eventLabel =
          GEOGRAPHIC_TIMELINE_EVENT_LABELS[
            type
          ];
        const reducedMotion =
          window.matchMedia(
            '(prefers-reduced-motion: reduce)',
          ).matches;
        const duration = reducedMotion
          ? 0
          : PLAYBACK_CAMERA_DURATION_MS;
        let motionActive = true;
        let fallbackTimer:
          number | null = null;
        let removalTimer:
          number | null = null;

        view.element.classList.remove(
          'issaved',
          'isupdated',
          'isremoved',
          'isip-saved',
          'isRemoved',
        );
        view.element.classList.add(
          `is${type}`,
        );
        view.element.style.setProperty(
          '--marker-color',
          getMapMarkerColorValue(
            location.color,
          ),
        );
        view.element.setAttribute(
          'aria-label',
          `${eventLabel}: ${location.name}, ${location.category}`,
        );
        view.name.textContent =
          location.name;
        view.metadata.textContent =
          `${location.category} · ${eventLabel}`;
        view.status.textContent =
          `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
        view.marker.setLngLat([
          location.longitude,
          location.latitude,
        ]);

        if (!view.visible) {
          view.marker.addTo(map);
          view.visible = true;
        }

        const finishMotion = () => {
          if (!motionActive) {
            return;
          }

          motionActive = false;

          if (fallbackTimer !== null) {
            window.clearTimeout(
              fallbackTimer,
            );
            fallbackTimer = null;
          }

          if (type === 'removed') {
            removalTimer =
              window.setTimeout(() => {
                view.element.classList.add(
                  'isRemoved',
                );
              }, reducedMotion ? 0 : 240);
          }

          onCameraMotionChange(false);
        };

        onCameraMotionChange(true);
        map.stop();
        map.once(
          'moveend',
          finishMotion,
        );
        fallbackTimer =
          window.setTimeout(
            finishMotion,
            duration + 350,
          );
        map.flyTo({
          center: [
            location.longitude,
            location.latitude,
          ],
          zoom: Math.max(
            map.getZoom(),
            PLAYBACK_LOCATION_ZOOM,
          ),
          duration,
          speed: 1.1,
          curve: 1.3,
          essential: false,
        });

        return () => {
          map.off(
            'moveend',
            finishMotion,
          );

          if (fallbackTimer !== null) {
            window.clearTimeout(
              fallbackTimer,
            );
          }

          if (removalTimer !== null) {
            window.clearTimeout(
              removalTimer,
            );
          }

          if (motionActive) {
            motionActive = false;
            map.stop();
            onCameraMotionChange(false);
          }
        };
      }, [
        event,
        map,
        onCameraMotionChange,
        selectionRevision,
      ]);

      return null;
    },
  );
