import type { LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';

export type RecifeNeighborhood = { code: string; name: string; geometry: Polygon | MultiPolygon; version: '2023' };
export type RecifeStreet = { code: string; name: string; geometry: LineString | MultiLineString; version: '2026-03-02' };
