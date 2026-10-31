import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { LocationSelection } from './location-selection';

type Geometry = LineString | MultiLineString | Polygon | MultiPolygon;
type Options = {
  selection: LocationSelection;
  setSelection: Dispatch<SetStateAction<LocationSelection>>;
  onStatus(message: string): void;
  onGeometry(level: 'neighbourhood' | 'street', geometry: Geometry): void;
  onUnavailable(level: 'neighbourhood' | 'street'): void;
};

export function useRecifeGeometry({ selection, setSelection, onStatus, onGeometry, onUnavailable }: Options): void {
  const callbacks = useRef({ onStatus, onGeometry, onUnavailable });
  callbacks.current = { onStatus, onGeometry, onUnavailable };
  const cityId = selection.city?.id;
  const cityVerified = selection.city?.officialCode === '2611606' && selection.city.geometryMetadata?.source === 'IBGE · Malhas municipais';
  const neighborhoodId = selection.neighbourhood?.id;
  const neighborhoodName = selection.neighbourhood?.name;
  const neighborhoodCode = selection.neighbourhood?.officialCode;
  const neighborhoodResolved = selection.neighbourhood?.geometryMetadata?.source === 'Prefeitura do Recife · Bairros';
  const streetId = selection.street?.id;
  const streetName = selection.street?.name;
  const streetCode = selection.street?.officialCode;
  const streetResolved = selection.street?.geometryMetadata?.source === 'Prefeitura do Recife · Logradouros';

  useEffect(() => {
    if (!cityVerified || !cityId || !neighborhoodId || !neighborhoodName || neighborhoodResolved) return undefined;
    const requestId = crypto.randomUUID();
    let active = true;
    callbacks.current.onStatus('Consultando limite oficial de bairro do Recife…');
    void window.zeroHub.recifeGeometry.neighborhood('2611606', neighborhoodName, requestId, neighborhoodCode).then((result) => {
      if (!active) return;
      if (!result) { callbacks.current.onStatus('Limite oficial do bairro não encontrado; seleção preservada.'); callbacks.current.onUnavailable('neighbourhood'); return; }
      setSelection((current) => {
        if (current.city?.id !== cityId || current.neighbourhood?.id !== neighborhoodId) return current;
        return { ...current, neighbourhood: { ...current.neighbourhood, officialCode: result.code, geometry: result.geometry, geometryMetadata: { source: 'Prefeitura do Recife · Bairros', license: 'ODbL · atribuição Prefeitura do Recife', version: result.version } } };
      });
      callbacks.current.onStatus(`Limite de bairro ${result.code} carregado · Prefeitura do Recife, 2023.`);
      callbacks.current.onGeometry('neighbourhood', result.geometry);
    }).catch(() => {
      if (active) { callbacks.current.onStatus('Limite oficial de bairro indisponível; seleção preservada.'); callbacks.current.onUnavailable('neighbourhood'); }
    });
    return () => { active = false; void window.zeroHub.recifeGeometry.cancel(requestId).catch((): void => { /* A consulta anterior foi descartada. */ }); };
  }, [cityId, cityVerified, neighborhoodCode, neighborhoodId, neighborhoodName, neighborhoodResolved, setSelection]);

  useEffect(() => {
    if (!cityVerified || !cityId || !neighborhoodResolved || !neighborhoodId || !neighborhoodCode || !streetId || !streetName || streetResolved) return undefined;
    const requestId = crypto.randomUUID();
    let active = true;
    callbacks.current.onStatus('Consultando via oficial do Recife e cache local; sem cache, o download pode chegar a 14 MB…');
    void window.zeroHub.recifeGeometry.street('2611606', neighborhoodCode, streetName, requestId, streetCode).then((result) => {
      if (!active) return;
      if (!result) { callbacks.current.onStatus('Via sem correspondência oficial inequívoca no bairro; seleção preservada.'); callbacks.current.onUnavailable('street'); return; }
      setSelection((current) => {
        if (current.city?.id !== cityId || current.neighbourhood?.id !== neighborhoodId || current.neighbourhood.officialCode !== neighborhoodCode || current.street?.id !== streetId) return current;
        return { ...current, street: { ...current.street, officialCode: result.code, geometry: result.geometry, geometryMetadata: { source: 'Prefeitura do Recife · Logradouros', license: 'ODbL · atribuição Prefeitura do Recife', version: result.version } } };
      });
      callbacks.current.onStatus(`Via ${result.code} carregada; a geometria completa pode atravessar outros bairros.`);
      callbacks.current.onGeometry('street', result.geometry);
    }).catch(() => {
      if (active) { callbacks.current.onStatus('Geometria oficial da via indisponível; seleção preservada.'); callbacks.current.onUnavailable('street'); }
    });
    return () => { active = false; void window.zeroHub.recifeGeometry.cancel(requestId).catch((): void => { /* A consulta anterior foi descartada. */ }); };
  }, [cityId, cityVerified, neighborhoodCode, neighborhoodId, neighborhoodResolved, setSelection, streetCode, streetId, streetName, streetResolved]);
}
