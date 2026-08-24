import {
  memo,
  useEffect,
  useRef,
} from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from 'maplibre-gl';

import {
  MAP_MARKER_COLORS,
  getMapMarkerColorValue,
} from './map-workspace.types';
import {
  hasValidIpGeolocationCoordinates,
} from './ip-geolocation.types';

import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Point,
  Polygon,
} from 'geojson';
import type {
  IpGeolocationResult,
} from './ip-geolocation.types';

type IpGeolocationMapLayerProps = {
  connectResults: boolean;
  map: MapLibreMap | null;
  results: IpGeolocationResult[];
  selectedResultId: string | null;

  onSelect(resultId: string): void;
  onError(error: unknown): void;
};

type MarkerActions = {
  select(resultId: string): void;
};

type IpMarkerProperties = {
  color: string;
  icon: string;
  kind: 'center' | 'triangle';
  resultId: string;
  selected: boolean;
};

const MARKER_SOURCE_ID =
  'ip-intelligence-markers';
const MARKER_FILL_LAYER_ID =
  'ip-intelligence-marker-fill';
const MARKER_LINE_LAYER_ID =
  'ip-intelligence-marker-line';
const MARKER_CENTER_LAYER_ID =
  'ip-intelligence-marker-center';
const MARKER_SYMBOL_LAYER_ID =
  'ip-intelligence-marker-symbol';
const MARKER_HITBOX_LAYER_ID =
  'ip-intelligence-marker-hitbox';

const ARC_SOURCE_ID =
  'ip-intelligence-arcs';
const ARC_BASE_LAYER_ID =
  'ip-intelligence-arcs-base';
const ARC_PULSE_LAYER_ID =
  'ip-intelligence-arcs-pulse';
const ARC_SEGMENTS = 32;
const ARC_FRAME_INTERVAL_MS = 40;
const MARKER_ICON_PREFIX =
  'ip-intelligence-triangle-';
const EARTH_RADIUS_METERS = 6_371_008.8;

function visualMarkerRadiusMeters(
  latitude: number,
  zoom: number,
): number {
  const latitudeScale = Math.max(
    0.12,
    Math.cos(
      latitude * Math.PI / 180,
    ),
  );
  const metersPerPixel =
    78_271.51696 *
    latitudeScale /
    2 ** zoom;
  const pixelRadius = Math.min(
    11,
    Math.max(4, 4 + zoom * 0.7),
  );

  return metersPerPixel * pixelRadius;
}

function destinationCoordinate(
  longitude: number,
  latitude: number,
  distanceMeters: number,
  bearingDegrees: number,
): [number, number] {
  const angularDistance =
    distanceMeters /
    EARTH_RADIUS_METERS;
  const bearing =
    bearingDegrees * Math.PI / 180;
  const latitudeRadians =
    latitude * Math.PI / 180;
  const longitudeRadians =
    longitude * Math.PI / 180;
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) *
      Math.cos(angularDistance) +
    Math.cos(latitudeRadians) *
      Math.sin(angularDistance) *
      Math.cos(bearing),
  );
  const destinationLongitude =
    longitudeRadians + Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(latitudeRadians),
      Math.cos(angularDistance) -
        Math.sin(latitudeRadians) *
        Math.sin(destinationLatitude),
    );

  return [
    (
      destinationLongitude *
        180 / Math.PI + 540
    ) % 360 - 180,
    destinationLatitude *
      180 / Math.PI,
  ];
}

function buildMarkerData(
  results: IpGeolocationResult[],
  selectedResultId: string | null,
  zoom: number,
): FeatureCollection<
  Geometry,
  IpMarkerProperties
> {
  const features: Feature<
    Geometry,
    IpMarkerProperties
  >[] = [];

  for (const result of results) {
    if (
      !hasValidIpGeolocationCoordinates(
        result,
      )
    ) {
      continue;
    }

    const selected =
      result.id === selectedResultId;
    const properties = {
      color:
        getMapMarkerColorValue(
          result.color,
        ),
      resultId: result.id,
      selected,
      icon:
        `${MARKER_ICON_PREFIX}${result.color}`,
    };
    const radius =
      visualMarkerRadiusMeters(
        result.latitude,
        zoom,
      );
    const triangle = [
      destinationCoordinate(
        result.longitude,
        result.latitude,
        radius,
        0,
      ),
      destinationCoordinate(
        result.longitude,
        result.latitude,
        radius,
        120,
      ),
      destinationCoordinate(
        result.longitude,
        result.latitude,
        radius,
        240,
      ),
    ];

    features.push({
      type: 'Feature',
      id: `triangle-${result.id}`,
      properties: {
        ...properties,
        kind: 'triangle',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...triangle,
          triangle[0],
        ]],
      } satisfies Polygon,
    });
    features.push({
      type: 'Feature',
      id: `center-${result.id}`,
      properties: {
        ...properties,
        kind: 'center',
      },
      geometry: {
        type: 'Point',
        coordinates: [
          result.longitude,
          result.latitude,
        ],
      } satisfies Point,
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function createTriangleImage(
  color: string,
): ImageData {
  const canvas =
    document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext(
    '2d',
  );

  if (!context) {
    throw new Error(
      'Não foi possível criar o indicador vetorial de IP.',
    );
  }

  context.clearRect(0, 0, 32, 32);
  context.beginPath();
  context.moveTo(16, 2);
  context.lineTo(30, 29);
  context.lineTo(2, 29);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#f4fff2';
  context.stroke();

  return context.getImageData(
    0,
    0,
    32,
    32,
  );
}

function createTooltipContent(
  result: IpGeolocationResult,
): HTMLElement {
  const element =
    document.createElement('div');
  const title =
    document.createElement('strong');
  const metadata =
    document.createElement('span');
  const location =
    document.createElement('small');

  element.className =
    'ipGeolocationVectorTooltip';
  title.textContent = result.ip;
  metadata.textContent =
    `${result.asn ?? 'ASN não informado'} · estimativa`;
  location.textContent = [
    result.city,
    result.region,
    result.country,
  ].filter(Boolean).join(', ') ||
    'Local não informado';
  element.append(
    title,
    metadata,
    location,
  );

  return element;
}

function buildArcCoordinates(
  from: IpGeolocationResult,
  to: IpGeolocationResult,
): [number, number][] {
  const coordinates:
    [number, number][] = [];
  const longitudeDelta =
    ((to.longitude -
      from.longitude + 540) % 360) -
    180;
  const latitudeDistance =
    Math.abs(
      to.latitude - from.latitude,
    );
  const curve = Math.min(
    20,
    4 +
      Math.abs(longitudeDelta) * 0.08 +
      latitudeDistance * 0.06,
  );
  const controlLatitude = Math.max(
    -78,
    Math.min(
      78,
      (from.latitude + to.latitude) /
        2 + curve,
    ),
  );

  for (
    let step = 0;
    step <= ARC_SEGMENTS;
    step += 1
  ) {
    const progress =
      step / ARC_SEGMENTS;
    const inverse = 1 - progress;
    const longitude =
      from.longitude +
      longitudeDelta * progress;
    const latitude =
      inverse * inverse *
        from.latitude +
      2 * inverse * progress *
        controlLatitude +
      progress * progress *
        to.latitude;

    coordinates.push([
      longitude,
      latitude,
    ]);
  }

  return coordinates;
}

function buildArcData(
  results: IpGeolocationResult[],
): FeatureCollection<LineString> {
  const ordered = [...results].sort(
    (left, right) =>
      Date.parse(left.consultedAt) -
      Date.parse(right.consultedAt),
  );
  const features:
    Feature<LineString>[] = [];

  for (
    let index = 1;
    index < ordered.length;
    index += 1
  ) {
    const from = ordered[index - 1];
    const to = ordered[index];

    features.push({
      type: 'Feature',
      id: `${from.id}-${to.id}`,
      properties: {
        fromColor:
          getMapMarkerColorValue(
            from.color,
          ),
        toColor:
          getMapMarkerColorValue(
            to.color,
          ),
      },
      geometry: {
        type: 'LineString',
        coordinates:
          buildArcCoordinates(from, to),
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function pulseGradient(
  progress: number,
): ExpressionSpecification {
  const start = Math.max(
    0,
    progress - 0.09,
  );
  const end = Math.min(
    1,
    progress + 0.09,
  );

  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    'rgba(255,255,255,0)',
    start,
    'rgba(255,255,255,0)',
    progress,
    'rgba(255,255,255,0.78)',
    end,
    'rgba(255,255,255,0)',
    1,
    'rgba(255,255,255,0)',
  ];
}

export const IpGeolocationMapLayer = memo(
  function IpGeolocationMapLayer({
    connectResults,
    map,
    onError,
    onSelect,
    results,
    selectedResultId,
  }: IpGeolocationMapLayerProps) {
    const actionsRef =
      useRef<MarkerActions>({
        select: () => undefined,
      });
    const resultsRef = useRef(results);
    const selectedResultIdRef =
      useRef(selectedResultId);
    const popupRef =
      useRef<maplibregl.Popup | null>(
        null,
      );
    actionsRef.current = {
      select: onSelect,
    };
    resultsRef.current = results;
    selectedResultIdRef.current =
      selectedResultId;

    useEffect(() => {
      if (!map) {
        return undefined;
      }

      let zoomFrame: number | null = null;
      let lastMarkerZoom =
        Number.NaN;
      const updateData = () => {
        const source = map.getSource(
          MARKER_SOURCE_ID,
        ) as GeoJSONSource | undefined;

        source?.setData(
          buildMarkerData(
            resultsRef.current,
            selectedResultIdRef.current,
            map.getZoom(),
          ),
        );
        lastMarkerZoom = map.getZoom();
      };
      const scheduleZoomUpdate = () => {
        if (
          Number.isFinite(lastMarkerZoom) &&
          Math.abs(
            map.getZoom() - lastMarkerZoom,
          ) < 0.01
        ) {
          return;
        }

        if (zoomFrame !== null) {
          return;
        }

        zoomFrame =
          window.requestAnimationFrame(() => {
            zoomFrame = null;
            updateData();
          });
      };
      const resultFromEvent = (
        event: MapLayerMouseEvent,
      ): IpGeolocationResult | null => {
        const resultId =
          event.features?.[0]
            ?.properties?.resultId;

        return typeof resultId ===
          'string'
          ? resultsRef.current.find(
            (result) =>
              result.id === resultId,
          ) ?? null
          : null;
      };
      const handleClick = (
        event: MapLayerMouseEvent,
      ) => {
        const result =
          resultFromEvent(event);

        if (result) {
          actionsRef.current.select(
            result.id,
          );
        }
      };
      const handleMouseEnter = (
        event: MapLayerMouseEvent,
      ) => {
        const result =
          resultFromEvent(event);

        map.getCanvas().style.cursor =
          result ? 'pointer' : '';

        if (!result) {
          return;
        }

        popupRef.current?.remove();
        popupRef.current =
          new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
          })
            .setLngLat([
              result.longitude,
              result.latitude,
            ])
            .setDOMContent(
              createTooltipContent(result),
            )
            .addTo(map);
      };
      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
        popupRef.current = null;
      };
      const removeMarkerResources = () => {
        try {
          for (const layerId of [
            MARKER_HITBOX_LAYER_ID,
            MARKER_SYMBOL_LAYER_ID,
            MARKER_CENTER_LAYER_ID,
            MARKER_LINE_LAYER_ID,
            MARKER_FILL_LAYER_ID,
          ]) {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
          }

          if (map.getSource(MARKER_SOURCE_ID)) {
            map.removeSource(MARKER_SOURCE_ID);
          }

          for (
            const color of
            MAP_MARKER_COLORS
          ) {
            const imageId =
              `${MARKER_ICON_PREFIX}${color.id}`;

            if (map.hasImage(imageId)) {
              map.removeImage(imageId);
            }
          }
        } catch (unknownError) {
          console.debug(
            '[IP Intelligence] O mapa já estava desmontado ao limpar a camada vetorial.',
            unknownError,
          );
        }
      };

      try {
        for (
          const color of MAP_MARKER_COLORS
        ) {
          const imageId =
            `${MARKER_ICON_PREFIX}${color.id}`;

          if (!map.hasImage(imageId)) {
            map.addImage(
              imageId,
              createTriangleImage(
                color.value,
              ),
            );
          }
        }

        map.addSource(MARKER_SOURCE_ID, {
          type: 'geojson',
          data: buildMarkerData(
            resultsRef.current,
            selectedResultIdRef.current,
            map.getZoom(),
          ),
        });
        map.addLayer({
          id: MARKER_FILL_LAYER_ID,
          type: 'fill',
          source: MARKER_SOURCE_ID,
          maxzoom: 10,
          filter: [
            '==',
            ['get', 'kind'],
            'triangle',
          ],
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['get', 'selected'],
              0.9,
              0.68,
            ],
          },
        });
        map.addLayer({
          id: MARKER_LINE_LAYER_ID,
          type: 'line',
          source: MARKER_SOURCE_ID,
          maxzoom: 10,
          filter: [
            '==',
            ['get', 'kind'],
            'triangle',
          ],
          paint: {
            'line-color': '#f4fff2',
            'line-opacity': [
              'case',
              ['get', 'selected'],
              0.96,
              0.66,
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0.25,
              0.7,
              10,
              2,
            ],
          },
        });
        map.addLayer({
          id: MARKER_CENTER_LAYER_ID,
          type: 'circle',
          source: MARKER_SOURCE_ID,
          filter: [
            '==',
            ['get', 'kind'],
            'center',
          ],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0.25,
              1.5,
              10,
              4,
            ],
            'circle-stroke-color':
              '#ffffff',
            'circle-stroke-width': [
              'case',
              ['get', 'selected'],
              1.5,
              0.5,
            ],
          },
        });
        map.addLayer({
          id: MARKER_SYMBOL_LAYER_ID,
          type: 'symbol',
          source: MARKER_SOURCE_ID,
          minzoom: 10,
          filter: [
            '==',
            ['get', 'kind'],
            'center',
          ],
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              0.45,
              18,
              0.78,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
        map.addLayer({
          id: MARKER_HITBOX_LAYER_ID,
          type: 'circle',
          source: MARKER_SOURCE_ID,
          filter: [
            '==',
            ['get', 'kind'],
            'center',
          ],
          paint: {
            'circle-color':
              'rgba(255,255,255,0.001)',
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0.25,
              10,
              10,
              15,
            ],
          },
        });
        map.on(
          'click',
          MARKER_HITBOX_LAYER_ID,
          handleClick,
        );
        map.on(
          'mouseenter',
          MARKER_HITBOX_LAYER_ID,
          handleMouseEnter,
        );
        map.on(
          'mouseleave',
          MARKER_HITBOX_LAYER_ID,
          handleMouseLeave,
        );
        map.on('zoom', scheduleZoomUpdate);
        map.on(
          'render',
          scheduleZoomUpdate,
        );
      } catch (unknownError) {
        removeMarkerResources();
        onError(unknownError);
        return undefined;
      }

      return () => {
        if (zoomFrame !== null) {
          window.cancelAnimationFrame(
            zoomFrame,
          );
        }

        popupRef.current?.remove();
        popupRef.current = null;
        map.getCanvas().style.cursor = '';
        map.off('zoom', scheduleZoomUpdate);
        map.off(
          'render',
          scheduleZoomUpdate,
        );
        map.off(
          'click',
          MARKER_HITBOX_LAYER_ID,
          handleClick,
        );
        map.off(
          'mouseenter',
          MARKER_HITBOX_LAYER_ID,
          handleMouseEnter,
        );
        map.off(
          'mouseleave',
          MARKER_HITBOX_LAYER_ID,
          handleMouseLeave,
        );
        removeMarkerResources();
      };
    }, [map, onError]);

    useEffect(() => {
      if (!map) {
        return;
      }

      for (const result of results) {
        if (
          !hasValidIpGeolocationCoordinates(
            result,
          )
        ) {
          onError(
            new Error(
              `Coordenadas inválidas para o resultado ${result.id}.`,
            ),
          );
        }
      }

      try {
        const source = map.getSource(
          MARKER_SOURCE_ID,
        ) as GeoJSONSource | undefined;

        source?.setData(
          buildMarkerData(
            results,
            selectedResultId,
            map.getZoom(),
          ),
        );
      } catch (unknownError) {
        console.debug(
          '[IP Intelligence] Atualização ignorada porque o mapa foi desmontado.',
          unknownError,
        );
      }
    }, [
      map,
      onError,
      results,
      selectedResultId,
    ]);

    useEffect(() => {
      if (
        !map ||
        !connectResults ||
        results.length < 2
      ) {
        return undefined;
      }

      const data = buildArcData(results);
      const orderedResults = [...results]
        .sort(
          (left, right) =>
            Date.parse(left.consultedAt) -
            Date.parse(right.consultedAt),
        );
      const firstResult =
        orderedResults[0];
      const lastResult =
        orderedResults[
          orderedResults.length - 1
        ];
      const removeArcResources = () => {
        try {
          if (map.getLayer(ARC_PULSE_LAYER_ID)) {
            map.removeLayer(
              ARC_PULSE_LAYER_ID,
            );
          }

          if (map.getLayer(ARC_BASE_LAYER_ID)) {
            map.removeLayer(
              ARC_BASE_LAYER_ID,
            );
          }

          if (map.getSource(ARC_SOURCE_ID)) {
            map.removeSource(ARC_SOURCE_ID);
          }
        } catch (unknownError) {
          console.debug(
            '[IP Intelligence] O mapa já estava desmontado ao limpar os arcos.',
            unknownError,
          );
        }
      };

      try {
        map.addSource(ARC_SOURCE_ID, {
          type: 'geojson',
          data,
          lineMetrics: true,
        });
        map.addLayer({
          id: ARC_BASE_LAYER_ID,
          type: 'line',
          source: ARC_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-width': 2.2,
            'line-opacity': 0.58,
            'line-blur': 0.35,
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0,
              getMapMarkerColorValue(
                firstResult.color,
              ),
              1,
              getMapMarkerColorValue(
                lastResult.color,
              ),
            ],
          },
        });
        map.addLayer({
          id: ARC_PULSE_LAYER_ID,
          type: 'line',
          source: ARC_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-width': 3.1,
            'line-opacity': 0.62,
            'line-blur': 0.8,
            'line-gradient':
              pulseGradient(0.1),
          },
        });
      } catch (unknownError) {
        removeArcResources();
        onError(unknownError);
        return undefined;
      }

      const reducedMotion =
        window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
      let animationFrame:
        number | null = null;
      const startedAt = performance.now();
      let lastPaintAt = 0;
      const animate = (now: number) => {
        try {
          if (
            now - lastPaintAt >=
            ARC_FRAME_INTERVAL_MS
          ) {
            const phase =
              0.1 +
              ((now - startedAt) % 3200) /
                3200 * 0.8;

            if (
              map.getLayer(
                ARC_PULSE_LAYER_ID,
              )
            ) {
              map.setPaintProperty(
                ARC_PULSE_LAYER_ID,
                'line-gradient',
                pulseGradient(phase),
              );
            }

            lastPaintAt = now;
          }
        } catch (unknownError) {
          console.debug(
            '[IP Intelligence] Animação dos arcos encerrada porque o mapa foi desmontado.',
            unknownError,
          );
          animationFrame = null;
          return;
        }

        animationFrame =
          window.requestAnimationFrame(
            animate,
          );
      };

      const startAnimation = () => {
        if (
          reducedMotion ||
          document.hidden ||
          animationFrame !== null
        ) {
          return;
        }

        animationFrame =
          window.requestAnimationFrame(animate);
      };
      const stopAnimation = () => {
        if (animationFrame === null) {
          return;
        }

        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      };
      const handleVisibilityChange = () => {
        if (document.hidden) {
          stopAnimation();
        } else {
          startAnimation();
        }
      };

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      startAnimation();

      return () => {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
        stopAnimation();

        removeArcResources();
      };
    }, [
      connectResults,
      map,
      onError,
      results,
    ]);

    return null;
  },
);
