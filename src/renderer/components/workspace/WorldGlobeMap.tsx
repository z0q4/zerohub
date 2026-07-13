import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import maplibregl, {
  type GeoJSONSourceSpecification,
  type Map,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import admin1DataRaw from '../../assets/map/admin1.geojson?raw';
import countriesDataRaw from '../../assets/map/countries.geojson?raw';
import populatedPlacesDataRaw from '../../assets/map/populated-places.geojson?raw';

import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';

type MapLabelKind =
  | 'country'
  | 'admin1'
  | 'city';

type MapLabel = {
  id: string;
  kind: MapLabelKind;
  name: string;
  coordinate: [number, number];
  minZoom: number;
  rank: number;
};

type ProjectedLabel = MapLabel & {
  x: number;
  y: number;
  visible: boolean;
};

type WorldGlobeMapProps = {
  drawerOpen: boolean;
  markerCount: number;
  resetSignal: number;
};

const INITIAL_CENTER: [number, number] = [
  -20,
  15,
];
const INITIAL_ZOOM = 0.7;
const ROTATION_ZOOM_LIMIT = 1.8;
const ROTATION_RESUME_DELAY_MS = 8000;
const ROTATION_DEGREES_PER_SECOND = 0.6;
const ROTATION_APPLY_INTERVAL_MS = 500;

const countriesData =
  JSON.parse(
    countriesDataRaw,
  ) as FeatureCollection;
const admin1Data =
  JSON.parse(
    admin1DataRaw,
  ) as FeatureCollection;
const populatedPlacesData =
  JSON.parse(
    populatedPlacesDataRaw,
  ) as FeatureCollection;

function asFeatureCollection(
  value: unknown,
): FeatureCollection {
  return value as FeatureCollection;
}

function createMapStyle():
  StyleSpecification {
  return {
    version: 8,
    sources: {
      countries: {
        type: 'geojson',
        data:
          countriesData as GeoJSONSourceSpecification['data'],
      },
      admin1: {
        type: 'geojson',
        data:
          admin1Data as GeoJSONSourceSpecification['data'],
      },
      places: {
        type: 'geojson',
        data:
          populatedPlacesData as GeoJSONSourceSpecification['data'],
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#030303',
        },
      },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            '#101112',
            5,
            '#141516',
          ],
          'fill-opacity': 0.98,
        },
      },
      {
        id: 'countries-border',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color':
            'rgba(255,255,255,0.16)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.45,
            5,
            1.2,
          ],
          'line-opacity': 0.85,
        },
      },
      {
        id: 'admin1-border',
        type: 'line',
        source: 'admin1',
        minzoom: 2.8,
        paint: {
          'line-color':
            'rgba(255,255,255,0.08)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2.8,
            0.35,
            7,
            0.9,
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2.8,
            0,
            4,
            0.72,
          ],
        },
      },
      {
        id: 'city-points',
        type: 'circle',
        source: 'places',
        minzoom: 4.8,
        paint: {
          'circle-color':
            'rgba(255,255,255,0.72)',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.8,
            1.1,
            8,
            2.4,
          ],
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.8,
            0.35,
            8,
            0.72,
          ],
        },
      },
    ],
  };
}

function coordinateDepth(
  coordinates: unknown,
): coordinates is Position {
  return (
    Array.isArray(coordinates) &&
    typeof coordinates[0] ===
      'number' &&
    typeof coordinates[1] === 'number'
  );
}

function collectPositions(
  coordinates: unknown,
  positions: Position[],
): void {
  if (coordinateDepth(coordinates)) {
    positions.push(coordinates);
    return;
  }

  if (!Array.isArray(coordinates)) {
    return;
  }

  for (const item of coordinates) {
    collectPositions(
      item,
      positions,
    );
  }
}

function geometryCentroid(
  geometry: Geometry | null,
): [number, number] | null {
  if (!geometry) {
    return null;
  }

  if (geometry.type === 'Point') {
    const [
      longitude,
      latitude,
    ] = geometry.coordinates;

    return [
      longitude,
      latitude,
    ];
  }

  if (
    geometry.type !== 'Polygon' &&
    geometry.type !== 'MultiPolygon'
  ) {
    return null;
  }

  const positions: Position[] = [];
  collectPositions(
    (
      geometry as Polygon | MultiPolygon
    ).coordinates,
    positions,
  );

  if (positions.length === 0) {
    return null;
  }

  const totals =
    positions.reduce(
      (accumulator, position) => ({
        longitude:
          accumulator.longitude +
          Number(position[0]),
        latitude:
          accumulator.latitude +
          Number(position[1]),
      }),
      {
        longitude: 0,
        latitude: 0,
      },
    );

  return [
    totals.longitude /
      positions.length,
    totals.latitude /
      positions.length,
  ];
}

function propertyString(
  feature: Feature,
  keys: string[],
): string | null {
  const properties =
    feature.properties ?? {};

  for (const key of keys) {
    const value = properties[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function propertyNumber(
  feature: Feature,
  keys: string[],
  fallback: number,
): number {
  const properties =
    feature.properties ?? {};

  for (const key of keys) {
    const value = properties[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function buildLabels(): MapLabel[] {
  const countries =
    asFeatureCollection(
      countriesData,
    );
  const admin1 =
    asFeatureCollection(
      admin1Data,
    );
  const places =
    asFeatureCollection(
      populatedPlacesData,
    );

  const countryLabels =
    countries.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['LABELRANK'],
            8,
          );
        const coordinate =
          geometryCentroid(
            feature.geometry,
          );
        const name =
          propertyString(
            feature,
            [
              'NAME_PT',
              'ADMIN',
              'NAME',
            ],
          );

        if (
          !coordinate ||
          !name ||
          rank > 4
        ) {
          return null;
        }

        return {
          id: `country-${index}`,
          kind: 'country' as const,
          name,
          coordinate,
          minZoom: rank <= 2 ? 0 : 1.4,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      );

  const adminLabels =
    admin1.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['scalerank'],
            9,
          );
        const coordinate =
          geometryCentroid(
            feature.geometry,
          );
        const name =
          propertyString(
            feature,
            ['name_pt', 'name'],
          );

        if (
          !coordinate ||
          !name ||
          rank > 5
        ) {
          return null;
        }

        return {
          id: `admin-${index}`,
          kind: 'admin1' as const,
          name,
          coordinate,
          minZoom: 2.8,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      )
      .slice(0, 420);

  const cityLabels =
    places.features
      .map((feature, index):
        | MapLabel
        | null => {
        const rank =
          propertyNumber(
            feature,
            ['SCALERANK'],
            9,
          );
        const geometry =
          feature.geometry as Point | null;

        if (
          !geometry ||
          geometry.type !== 'Point' ||
          rank > 7
        ) {
          return null;
        }

        const name =
          propertyString(
            feature,
            ['NAME', 'NAMEASCII'],
          );

        if (!name) {
          return null;
        }

        const [
          longitude,
          latitude,
        ] = geometry.coordinates;

        return {
          id: `city-${index}`,
          kind: 'city' as const,
          name,
          coordinate: [
            longitude,
            latitude,
          ] as [number, number],
          minZoom:
            rank <= 2
              ? 4.8
              : rank <= 5
                ? 6
                : 7.5,
          rank,
        };
      })
      .filter(
        (label): label is MapLabel =>
          label !== null,
      )
      .slice(0, 700);

  return [
    ...countryLabels,
    ...adminLabels,
    ...cityLabels,
  ];
}

export function WorldGlobeMap({
  drawerOpen,
  markerCount,
  resetSignal,
}: WorldGlobeMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const mapRef =
    useRef<Map | null>(null);
  const mapReadyRef =
    useRef(false);
  const frameRef =
    useRef<number | null>(null);
  const lastFrameRef =
    useRef<number | null>(null);
  const resumeAtRef =
    useRef(0);
  const reducedMotionRef =
    useRef(false);
  const [
    projectedLabels,
    setProjectedLabels,
  ] =
    useState<ProjectedLabel[]>([]);
  const [
    rotationEnabled,
    setRotationEnabled,
  ] = useState(true);
  const [
    monochromeMode,
    setMonochromeMode,
  ] = useState(false);
  const [
    mapReady,
    setMapReady,
  ] = useState(false);
  const labels =
    useMemo(
      buildLabels,
      [],
    );

  const updateProjectedLabels =
    useCallback(() => {
      const map = mapRef.current;

      if (
        !map ||
        !mapReadyRef.current
      ) {
        return;
      }

      const zoom = map.getZoom();
      const bounds =
        map.getContainer()
          .getBoundingClientRect();
      const maxLabels =
        zoom < 2.8
          ? 42
          : zoom < 4.8
            ? 110
            : 170;

      setProjectedLabels(
        labels
          .filter(
            (label) =>
              zoom >= label.minZoom,
          )
          .sort(
            (left, right) =>
              left.rank - right.rank,
          )
          .slice(0, maxLabels)
          .map((label) => {
            const projected =
              map.project(
                label.coordinate,
              );

            return {
              ...label,
              x: projected.x,
              y: projected.y,
              visible:
                projected.x > -80 &&
                projected.y > -30 &&
                projected.x <
                  bounds.width + 80 &&
                projected.y <
                  bounds.height + 30,
            };
          }),
      );
    }, [labels]);

  const pauseRotation =
    useCallback(() => {
      resumeAtRef.current =
        performance.now() +
        ROTATION_RESUME_DELAY_MS;
    }, []);

  const recenterMap =
    useCallback(() => {
      const map = mapRef.current;

      if (
        !map ||
        !mapReadyRef.current
      ) {
        return;
      }

      map.easeTo({
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: 0,
        bearing: 0,
        duration:
          reducedMotionRef.current
            ? 0
            : 700,
      });
    }, []);

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
  }, []);

  useEffect(() => {
    const container =
      containerRef.current;

    if (
      !container ||
      mapRef.current
    ) {
      return undefined;
    }

    const map =
      new maplibregl.Map({
        container,
        style: createMapStyle(),
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 0.25,
        maxZoom: 10,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        renderWorldCopies: false,
        cooperativeGestures: false,
      });

    mapRef.current = map;

    const handleReady = () => {
      map.setProjection({
        type: 'globe',
      });
      mapReadyRef.current = true;
      setMapReady(true);
      updateProjectedLabels();
    };

    const handleMove = () => {
      updateProjectedLabels();
    };

    const handleInteraction = () => {
      pauseRotation();
    };

    map.on('load', handleReady);
    map.on('move', handleMove);
    map.on('zoom', handleMove);
    map.on('resize', handleMove);
    map.on('mousedown', handleInteraction);
    map.on('touchstart', handleInteraction);
    map.on('wheel', handleInteraction);
    map.on('dragstart', handleInteraction);
    map.on('zoomstart', handleInteraction);

    const resizeObserver =
      new ResizeObserver(() => {
        if (!mapReadyRef.current) {
          return;
        }

        map.resize();
        updateProjectedLabels();
      });
    resizeObserver.observe(container);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(
          frameRef.current,
        );
      }

      resizeObserver.disconnect();
      map.off('load', handleReady);
      map.off('move', handleMove);
      map.off('zoom', handleMove);
      map.off('resize', handleMove);
      map.off('mousedown', handleInteraction);
      map.off('touchstart', handleInteraction);
      map.off('wheel', handleInteraction);
      map.off('dragstart', handleInteraction);
      map.off('zoomstart', handleInteraction);
      map.remove();
      mapReadyRef.current = false;
      mapRef.current = null;
    };
  }, [
    pauseRotation,
    updateProjectedLabels,
  ]);

  useEffect(() => {
    const animate = (
      timestamp: number,
    ) => {
      const map = mapRef.current;
      if (lastFrameRef.current === null) {
        lastFrameRef.current =
          timestamp;
      }

      const lastTimestamp =
        lastFrameRef.current;
      const deltaSeconds =
        (timestamp - lastTimestamp) /
        1000;

      if (
        map &&
        mapReadyRef.current &&
        rotationEnabled &&
        !reducedMotionRef.current &&
        timestamp >= resumeAtRef.current &&
        map.getZoom() <=
          ROTATION_ZOOM_LIMIT
      ) {
        if (
          timestamp - lastTimestamp >=
          ROTATION_APPLY_INTERVAL_MS
        ) {
          const center =
            map.getCenter();

          map.setCenter([
            center.lng +
              ROTATION_DEGREES_PER_SECOND *
                deltaSeconds,
            center.lat,
          ]);
          lastFrameRef.current =
            timestamp;
        }
      } else {
        lastFrameRef.current =
          timestamp;
      }

      frameRef.current =
        window.requestAnimationFrame(
          animate,
        );
    };

    frameRef.current =
      window.requestAnimationFrame(
        animate,
      );

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(
          frameRef.current,
        );
      }
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [rotationEnabled]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReadyRef.current
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      map.resize();
      updateProjectedLabels();
    });
  }, [
    drawerOpen,
    updateProjectedLabels,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !mapReadyRef.current
    ) {
      return;
    }

    map.setPaintProperty(
      'background',
      'background-color',
      monochromeMode
        ? '#000000'
        : '#030303',
    );
    map.setPaintProperty(
      'countries-fill',
      'fill-color',
      monochromeMode
        ? '#0f0f0f'
        : [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          '#101112',
          5,
          '#141516',
        ],
    );
    map.setPaintProperty(
      'countries-border',
      'line-color',
      monochromeMode
        ? 'rgba(255,255,255,0.24)'
        : 'rgba(255,255,255,0.16)',
    );
    map.setPaintProperty(
      'admin1-border',
      'line-color',
      monochromeMode
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(255,255,255,0.08)',
    );
    map.setPaintProperty(
      'city-points',
      'circle-color',
      monochromeMode
        ? 'rgba(255,255,255,0.82)'
        : 'rgba(255,255,255,0.72)',
    );
  }, [monochromeMode]);

  useEffect(() => {
    recenterMap();
  }, [
    recenterMap,
    resetSignal,
  ]);

  return (
    <div
      className={`worldGlobeMap ${
        monochromeMode
          ? 'isMonochrome'
          : ''
      }`}
    >
      <div
        className="worldGlobeMapCanvas"
        ref={containerRef}
      />

      <div
        className="worldGlobeLabels"
        aria-hidden="true"
      >
        {projectedLabels.map(
          (label) =>
            label.visible && (
              <span
                key={label.id}
                className={`worldGlobeLabel ${label.kind}`}
                style={{
                  transform: `translate(${label.x}px, ${label.y}px)`,
                }}
              >
                {label.name}
              </span>
            ),
        )}
      </div>

      {!mapReady && (
        <div className="worldMapEmptyState">
          Inicializando globo local...
        </div>
      )}

      {markerCount === 0 &&
        mapReady && (
          <div className="worldMapEmptyState">
            Nenhuma coordenada cadastrada nos cases.
          </div>
        )}

      <div
        className="worldGlobeControls"
        aria-label="Controles do mapa"
      >
        <button
          type="button"
          aria-label="Aproximar mapa"
          onClick={() => {
            mapRef.current?.zoomIn({
              duration:
                reducedMotionRef.current
                  ? 0
                  : 220,
            });
          }}
        >
          +
        </button>

        <button
          type="button"
          aria-label="Afastar mapa"
          onClick={() => {
            mapRef.current?.zoomOut({
              duration:
                reducedMotionRef.current
                  ? 0
                  : 220,
            });
          }}
        >
          −
        </button>

        <button
          type="button"
          aria-label="Recentralizar globo"
          onClick={recenterMap}
        >
          ⊙
        </button>

        <button
          type="button"
          aria-label={
            rotationEnabled
              ? 'Pausar rotação do globo'
              : 'Retomar rotação do globo'
          }
          aria-pressed={rotationEnabled}
          onClick={() => {
            setRotationEnabled(
              (current) =>
                !current,
            );
          }}
        >
          {rotationEnabled
            ? 'II'
            : '▶'}
        </button>

        <button
          type="button"
          aria-label={
            monochromeMode
              ? 'Desativar preto e branco'
              : 'Ativar preto e branco'
          }
          aria-pressed={monochromeMode}
          onClick={() => {
            setMonochromeMode(
              (enabled) =>
                !enabled,
            );
          }}
        >
          P/B
        </button>
      </div>
    </div>
  );
}
