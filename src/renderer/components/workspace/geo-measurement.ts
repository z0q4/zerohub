export type GeographicCoordinate = [
  number,
  number,
];

const EARTH_RADIUS_METERS = 6_371_008.8;

function radians(value: number): number {
  return value * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

export function normalizeLongitude(
  longitude: number,
): number {
  return (
    (longitude + 540) % 360
  ) - 180;
}

export function distanceMeters(
  start: GeographicCoordinate,
  end: GeographicCoordinate,
): number {
  const startLatitude = radians(start[1]);
  const endLatitude = radians(end[1]);
  const latitudeDelta =
    endLatitude - startLatitude;
  const longitudeDelta = radians(
    normalizeLongitude(end[0] - start[0]),
  );
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine),
    );
}

export function polygonAreaSquareMeters(
  coordinates: GeographicCoordinate[],
): number {
  if (coordinates.length < 3) {
    return 0;
  }

  const sphericalExcess = coordinates.reduce(
    (total, coordinate, index) => {
      const next = coordinates[
        (index + 1) % coordinates.length
      ];
      const longitudeDelta = radians(
        normalizeLongitude(next[0] - coordinate[0]),
      );

      return total + longitudeDelta * (
        2 +
        Math.sin(radians(coordinate[1])) +
        Math.sin(radians(next[1]))
      );
    },
    0,
  );

  return Math.abs(sphericalExcess) *
    EARTH_RADIUS_METERS ** 2 / 2;
}

export function bearingDegrees(
  start: GeographicCoordinate,
  end: GeographicCoordinate,
): number {
  const startLatitude = radians(start[1]);
  const endLatitude = radians(end[1]);
  const longitudeDelta = radians(
    normalizeLongitude(end[0] - start[0]),
  );
  const y = Math.sin(longitudeDelta) *
    Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) *
      Math.sin(endLatitude) -
    Math.sin(startLatitude) *
      Math.cos(endLatitude) *
      Math.cos(longitudeDelta);

  return (
    degrees(Math.atan2(y, x)) + 360
  ) % 360;
}

export function destinationCoordinate(
  center: GeographicCoordinate,
  distance: number,
  bearing: number,
): GeographicCoordinate {
  const angularDistance =
    distance / EARTH_RADIUS_METERS;
  const centerLatitude = radians(center[1]);
  const centerLongitude = radians(center[0]);
  const bearingRadians = radians(bearing);
  const latitude = Math.asin(
    Math.sin(centerLatitude) *
      Math.cos(angularDistance) +
    Math.cos(centerLatitude) *
      Math.sin(angularDistance) *
      Math.cos(bearingRadians),
  );
  const longitude =
    centerLongitude +
    Math.atan2(
      Math.sin(bearingRadians) *
        Math.sin(angularDistance) *
        Math.cos(centerLatitude),
      Math.cos(angularDistance) -
        Math.sin(centerLatitude) *
        Math.sin(latitude),
    );

  return [
    normalizeLongitude(degrees(longitude)),
    degrees(latitude),
  ];
}
