import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
import { matchIbgeMunicipality } from '../../../shared/municipal-boundaries/municipal-boundaries.types';
import type { LocationSelection } from './location-selection';
import { ibgeStateForSelection } from './location-boundaries';

type Options = {
  selection: LocationSelection;
  setSelection: Dispatch<SetStateAction<LocationSelection>>;
  onStatus(message: string): void;
  onBoundary(geometry: Polygon | MultiPolygon): void;
  onUnavailable(): void;
};

export function useIbgeMunicipality({ selection, setSelection, onStatus, onBoundary, onUnavailable }: Options): void {
  const callbacks = useRef({ onStatus, onBoundary, onUnavailable });
  callbacks.current = { onStatus, onBoundary, onUnavailable };
  const countryId = selection.country?.id;
  const regionId = selection.region?.id;
  const cityId = selection.city?.id;
  const name = selection.city?.name;
  const alreadyResolved = selection.city?.geometryMetadata?.source === 'IBGE · Malhas municipais';
  const savedCode = selection.city?.officialCode;
  const stateCode = ibgeStateForSelection(selection);

  useEffect(() => {
    if (!stateCode || !countryId || !regionId || !cityId || !name || alreadyResolved) return undefined;
    const requestId = crypto.randomUUID();
    let active = true;
    callbacks.current.onStatus('Consultando limite municipal do IBGE…');
    void (async () => {
      try {
        const municipalities = await window.zeroHub.ibgeBoundaries.list(stateCode, requestId);
        if (!active) return;
        const municipality = matchIbgeMunicipality(municipalities, stateCode, name, savedCode);
        if (!municipality) {
          if (active) { callbacks.current.onStatus('Município não identificado de forma única no catálogo IBGE da UF.'); callbacks.current.onUnavailable(); }
          return;
        }
        const boundary = await window.zeroHub.ibgeBoundaries.geometry(stateCode, municipality.code, requestId);
        if (!active) return;
        setSelection((current) => {
          if (current.country?.id !== countryId || current.region?.id !== regionId || current.city?.id !== cityId) return current;
          return { ...current, city: { ...current.city, officialCode: boundary.code, geometry: boundary.geometry, geometryMetadata: { source: 'IBGE · Malhas municipais', license: 'Dados públicos IBGE · atribuição', version: boundary.version } } };
        });
        callbacks.current.onStatus(`Limite municipal IBGE ${boundary.code} carregado (malha simplificada).`);
        callbacks.current.onBoundary(boundary.geometry);
      } catch {
        if (active) { callbacks.current.onStatus('Limite municipal IBGE indisponível; a seleção foi preservada.'); callbacks.current.onUnavailable(); }
      }
    })();
    return () => { active = false; void window.zeroHub.ibgeBoundaries.cancel(requestId).catch((): void => { /* A consulta já foi descartada. */ }); };
  }, [alreadyResolved, cityId, countryId, name, regionId, savedCode, setSelection, stateCode]);
}
