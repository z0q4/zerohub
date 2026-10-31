import type { MultiPolygon, Polygon } from 'geojson';

export type IbgeMunicipality = { code: string; name: string; stateCode: string };
export type IbgeBoundary = { code: string; stateCode: string; geometry: Polygon | MultiPolygon; source: 'IBGE'; version: string | null };

const STATES: Readonly<Record<string, string>> = {
  acre: '12', alagoas: '27', amapa: '16', amazonas: '13', bahia: '29', ceara: '23',
  'distrito federal': '53', 'espirito santo': '32', goias: '52', maranhao: '21', 'mato grosso': '51',
  'mato grosso do sul': '50', 'minas gerais': '31', para: '15', paraiba: '25', parana: '41',
  pernambuco: '26', piaui: '22', 'rio de janeiro': '33', 'rio grande do norte': '24',
  'rio grande do sul': '43', rondonia: '11', roraima: '14', 'santa catarina': '42',
  'sao paulo': '35', sergipe: '28', tocantins: '17',
};
export function normalizeMunicipalityName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}
export function ibgeStateCode(name: string): string | null { return STATES[normalizeMunicipalityName(name)] ?? null; }
export function isIbgeStateCode(value: unknown): value is string { return typeof value === 'string' && Object.values(STATES).includes(value); }
export function isIbgeMunicipalityCode(value: unknown, stateCode: string): value is string {
  return typeof value === 'string' && /^\d{7}$/.test(value) && value.startsWith(stateCode);
}

export function matchIbgeMunicipality(items: readonly IbgeMunicipality[], stateCode: string, name: string, savedCode?: string): IbgeMunicipality | null {
  const matches = items.filter((item) => item.stateCode === stateCode && normalizeMunicipalityName(item.name) === normalizeMunicipalityName(name) && (!savedCode || item.code === savedCode));
  return matches.length === 1 ? matches[0] : null;
}
