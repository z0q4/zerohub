export const INTELLIGENCE_CATEGORIES = [
  { id: 'health', label: 'Saúde', icon: '✚', color: '#ef8a8a', tags: [['amenity', 'hospital'], ['amenity', 'clinic'], ['amenity', 'doctors'], ['amenity', 'pharmacy'], ['healthcare', 'centre'], ['healthcare', 'clinic'], ['healthcare', 'hospital']] },
  { id: 'education', label: 'Educação', icon: '◆', color: '#d5b77c', tags: [['amenity', 'school'], ['amenity', 'university'], ['amenity', 'college'], ['amenity', 'library']] },
  { id: 'transport', label: 'Transporte', icon: '▲', color: '#8cbbe1', tags: [['aeroway', 'aerodrome'], ['railway', 'station'], ['amenity', 'bus_station'], ['amenity', 'ferry_terminal'], ['public_transport', 'station']] },
  { id: 'public', label: 'Serviços públicos', icon: '●', color: '#9ccaa8', tags: [['amenity', 'police'], ['amenity', 'fire_station'], ['amenity', 'townhall'], ['amenity', 'public_building'], ['amenity', 'government'], ['office', 'government'], ['amenity', 'community_centre']] },
] as const;
export type IntelligenceCategory = typeof INTELLIGENCE_CATEGORIES[number]['id'];
export type IntelligenceBounds = [number, number, number, number]; // south, west, north, east
export type IntelligencePoint = { id: string; category: IntelligenceCategory; latitude: number; longitude: number; name: string | null; tags: Record<string, string>; representation: 'node' | 'bbox-center'; source: 'OpenStreetMap'; license: 'ODbL-1.0' };
export type IntelligenceQuery = { requestId: string; bbox: IntelligenceBounds; categories: IntelligenceCategory[] };
export type IntelligenceResponse = { points: IntelligencePoint[]; fetchedAt: string; dataTimestamp: string | null; cached: boolean };
export interface IntelligenceProvider { query(request: IntelligenceQuery): Promise<IntelligenceResponse>; cancel(requestId: string): boolean }
export function isIntelligenceCategory(value: unknown): value is IntelligenceCategory { return INTELLIGENCE_CATEGORIES.some((category) => category.id === value); }
