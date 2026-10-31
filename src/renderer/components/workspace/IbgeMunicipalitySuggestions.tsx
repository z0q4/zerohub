import { useEffect, useRef, useState } from 'react';
import type { IbgeMunicipality } from '../../../shared/municipal-boundaries/municipal-boundaries.types';
import { normalizeMunicipalityName } from '../../../shared/municipal-boundaries/municipal-boundaries.types';
import type { LocationSelection, SelectedGeographicFeature } from './location-selection';
import { geometryBounds, ibgeStateForSelection } from './location-boundaries';

type Props = {
  active: boolean;
  query: string;
  selection: LocationSelection;
  onSelect(result: SelectedGeographicFeature): void;
};

export function IbgeMunicipalitySuggestions({ active, query, selection, onSelect }: Props) {
  const [items, setItems] = useState<IbgeMunicipality[]>([]);
  const [message, setMessage] = useState('');
  const [choosing, setChoosing] = useState(false);
  const pendingChoice = useRef<string | null>(null);
  const stateCode = ibgeStateForSelection(selection);

  useEffect(() => {
    setChoosing(false);
    return () => {
      const id = pendingChoice.current;
      pendingChoice.current = null;
      if (id) void window.zeroHub.ibgeBoundaries.cancel(id).catch((): void => { /* A seleção anterior foi descartada. */ });
    };
  }, [active, query, stateCode]);

  useEffect(() => {
    if (!active || !stateCode || query.trim().length < 3) {
      setItems([]);
      setMessage('');
      return undefined;
    }
    let current = true;
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      setMessage('Consultando catálogo municipal do IBGE…');
      void window.zeroHub.ibgeBoundaries.list(stateCode, requestId).then((list) => {
        if (!current) return;
        const needle = normalizeMunicipalityName(query);
        const matches = list.filter((item) => item.stateCode === stateCode && normalizeMunicipalityName(item.name).includes(needle)).slice(0, 15);
        setItems(matches);
        setMessage(matches.length ? 'Municípios do IBGE na UF selecionada:' : 'Nenhum município IBGE encontrado nesta UF.');
      }).catch(() => {
        if (current) { setItems([]); setMessage('Catálogo IBGE indisponível; a busca Photon permanece disponível.'); }
      });
    }, 500);
    return () => {
      current = false;
      window.clearTimeout(timer);
      void window.zeroHub.ibgeBoundaries.cancel(requestId).catch((): void => { /* A consulta anterior foi descartada. */ });
    };
  }, [active, query, stateCode]);

  async function choose(item: IbgeMunicipality): Promise<void> {
    if (!stateCode || choosing) return;
    const requestId = crypto.randomUUID();
    pendingChoice.current = requestId;
    setChoosing(true);
    setMessage(`Carregando a malha IBGE ${item.code}…`);
    try {
      const boundary = await window.zeroHub.ibgeBoundaries.geometry(stateCode, item.code, requestId);
      if (pendingChoice.current !== requestId) return;
      const bounds = geometryBounds(boundary.geometry);
      if (!bounds) throw new Error('Malha sem coordenadas válidas.');
      const latitude = (bounds[0][1] + bounds[1][1]) / 2;
      const longitude = ((bounds[0][0] + bounds[1][0]) / 2 + 540) % 360 - 180;
      onSelect({
        id: `ibge:municipio:${item.code}`, provider: 'local', sourceId: item.code,
        name: item.name, label: `${item.name} · IBGE ${item.code}`, type: 'city',
        latitude, longitude, boundingBox: null,
        country: selection.country?.name ?? null, region: selection.region?.name ?? null,
        city: item.name, district: null, street: null, houseNumber: null, postalCode: null,
        attribution: 'IBGE · coordenada central aproximada da malha', approximate: true,
        fetchedAt: new Date().toISOString(), cached: false, officialCode: item.code,
        geometry: boundary.geometry,
        geometryMetadata: { source: 'IBGE · Malhas municipais', license: 'Dados públicos IBGE · atribuição', version: boundary.version },
      });
    } catch {
      if (pendingChoice.current === requestId) setMessage('Malha IBGE indisponível; escolha um resultado Photon para manter a localização.');
    } finally {
      if (pendingChoice.current === requestId) { pendingChoice.current = null; setChoosing(false); }
    }
  }

  if (!active || !stateCode || query.trim().length < 3) return null;
  return <span className="locationSuggestions" aria-label="Municípios do IBGE">
    <small aria-live="polite">{message}</small>
    {items.map((item) => <button type="button" key={item.code} disabled={choosing} onClick={() => { void choose(item); }}>{item.name} · IBGE {item.code}</button>)}
  </span>;
}
