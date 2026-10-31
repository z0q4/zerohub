import { useEffect, useId, useState } from 'react';
import type { GeographicSearchResult } from '../../../shared/geographic-search/geographic-search.types';
import { parseUniversalCoordinates } from '../../../shared/geographic-search/geographic-search.validation';
import type { FeatureCollection } from 'geojson';
import { LOCATION_LEVELS, matchesLocationParents } from './location-selection';
import { searchLocalBoundaries } from './location-boundaries';
import { IbgeMunicipalitySuggestions } from './IbgeMunicipalitySuggestions';
import type { LocationLevel, LocationProvider, LocationSelection } from './location-selection';

const labels: Record<LocationLevel, string> = {
  country: 'País', region: 'Estado / região', city: 'Cidade',
  neighbourhood: 'Bairro / distrito', street: 'Rua / via', exact: 'Local exato',
};

const provider: LocationProvider = {
  search: (requestId, query) => window.zeroHub.geographicSearch.search({ requestId, query, language: 'pt', filter: 'all' }),
  cancel: (requestId) => window.zeroHub.geographicSearch.cancel(requestId),
};

function suggestionLabel(result: GeographicSearchResult): string {
  return result.label === result.name ? result.name : `${result.name} — ${result.label}`;
}

function LocationField({ active, level, selection, countries, regions, onSelect }: {
  active: boolean;
  countries: FeatureCollection; regions: FeatureCollection;
  level: LocationLevel; selection: LocationSelection;
  onSelect(result: GeographicSearchResult | null): void;
}) {
  const listId = useId();
  const selected = selection[level];
  const [query, setQuery] = useState(selected?.name ?? '');
  const [results, setResults] = useState<GeographicSearchResult[]>([]);
  const [message, setMessage] = useState('');
  const index = LOCATION_LEVELS.indexOf(level);
  const enabled = active && (index === 0 || Boolean(selection[LOCATION_LEVELS[index - 1]]) || (level === 'exact' && Boolean(selection.city)));
  const coordinates = level === 'exact' ? parseUniversalCoordinates(query) : null;
  const parentNames = LOCATION_LEVELS.slice(0, index).map((parent) => selection[parent]?.name ?? '');
  const parentQuery = parentNames.reverse().join(', ');

  useEffect(() => {
    if (!enabled || selected || query.trim().length < 3) {
      setResults([]);
      setMessage('');
      return undefined;
    }
    if (coordinates) { setResults([]); setMessage('Coordenada informada: a relação com os níveis anteriores não é verificada.'); return undefined; }
    if (level === 'country' || level === 'region') {
      const matches = searchLocalBoundaries(level, query, selection, countries, regions);
      setResults(matches);
      setMessage(matches.length ? 'Escolha um limite Natural Earth da lista.' : 'Nenhum limite local encontrado.');
      return undefined;
    }
    let active = true;
    const requestId = crypto.randomUUID();
    setMessage('Aguardando pesquisa…');
    const timer = window.setTimeout(() => {
      setMessage('Pesquisando…');
      const text = [query.trim(), parentQuery].filter(Boolean).join(', ').slice(0, 160);
      void provider.search(requestId, text).then((response) => {
        if (!active) return;
        if (response.ok === false) {
          setResults([]);
          setMessage(response.error.message);
          return;
        }
        const compatible = response.results.filter((item) => matchesLocationParents(level, item, selection));
        setResults(compatible);
        setMessage(compatible.length ? 'Escolha um resultado da lista.' : 'Nenhum resultado compatível retornado.');
      }).catch(() => {
        if (active) setMessage('Não foi possível consultar a localização.');
      });
    }, 500);
    return () => { active = false; window.clearTimeout(timer); void provider.cancel(requestId).catch((): void => { /* A consulta já foi descartada. */ }); };
  }, [countries, enabled, level, parentQuery, query, regions, selected, selection, coordinates?.latitude, coordinates?.longitude]);

  return <label className="locationField">
    <span>{labels[level]}</span>
    <div>
      <input aria-label={labels[level]} list={listId} value={query} disabled={!enabled} placeholder={enabled ? 'Digite ao menos 3 caracteres' : 'Selecione o nível anterior'} onChange={(event) => {
        const value = event.currentTarget.value;
        setQuery(value);
        const found = results.find((item) => suggestionLabel(item) === value);
        if (found) { setQuery(found.name); onSelect(found); }
        else if (selected) onSelect(null);
      }} />
      <button type="button" aria-label={`Limpar ${labels[level]}`} disabled={!query && !selected} onClick={() => { setQuery(''); onSelect(null); }}>×</button>
    </div>
    <datalist id={listId}>{results.map((item) => <option value={suggestionLabel(item)} key={item.id} />)}</datalist>
    {level === 'city' && <IbgeMunicipalitySuggestions active={enabled && !selected} query={query} selection={selection} onSelect={(result) => { setQuery(result.name); onSelect(result); }} />}
    {results.length > 0 && <span className="locationSuggestions" aria-label={`Sugestões de ${labels[level]}`}>{results.map((item) => <button type="button" key={item.id} onClick={() => { setQuery(item.name); onSelect(item); }}>{suggestionLabel(item)}</button>)}</span>}
    {enabled && !selected && coordinates && <button type="button" onClick={() => { const name = `${coordinates.latitude}, ${coordinates.longitude}`; setQuery(name); onSelect({ id: `coordinate:${name}`, provider: 'local', sourceId: 'user-coordinate', name, label: name, type: 'coordinate', latitude: coordinates.latitude, longitude: coordinates.longitude, boundingBox: null, country: null, region: null, city: null, district: null, street: null, houseNumber: null, postalCode: null, attribution: 'Coordenada informada pelo usuário; relação com a hierarquia não verificada', approximate: true, fetchedAt: new Date().toISOString(), cached: false }); }}>Usar coordenadas informadas</button>}
    <small aria-live="polite">{selected ? selected.geometryMetadata ? `${selected.geometryMetadata.source}${selected.officialCode ? ` · ${selected.officialCode}` : ''}${selected.geometryMetadata.version ? ` · ${selected.geometryMetadata.version}` : ''} · ${selected.geometryMetadata.license}${level === 'street' ? ' · via completa pode atravessar outros bairros' : level === 'neighbourhood' ? ' · limite da base oficial' : ' · limite simplificado'}` : selected.sourceId === 'user-coordinate' ? selected.attribution : `${selected.attribution} · ponto aproximado; geometria não carregada` : message}</small>
  </label>;
}

export function HierarchicalLocationPanel({ open, active, selection, countries, regions, autoZoom, caseName, savedLocations, busy, feedback, onClose, onSelect, onClear, onAutoZoom, onSave, onRestore, onMarker }: {
  open: boolean; active: boolean; selection: LocationSelection; autoZoom: boolean; caseName: string | null; busy: boolean; feedback: string | null;
  countries: FeatureCollection; regions: FeatureCollection;
  savedLocations: { id: string; title: string }[];
  onClose(): void; onSelect(level: LocationLevel, result: GeographicSearchResult | null): void; onClear(): void; onAutoZoom(value: boolean): void; onSave(): void; onRestore(id: string): void; onMarker(): void;
}) {
  const [reset, setReset] = useState(0);
  return <section className="hierarchicalLocationPanel" hidden={!open} aria-label="Localização hierárquica">
    <header><div><span>LOCALIZAÇÃO</span><strong>Pesquisa hierárquica</strong></div><button type="button" onClick={onClose} aria-label="Recolher localização">—</button></header>
    <p>Pesquise e selecione cada nível. Limites locais, IBGE e Prefeitura do Recife complementam a busca Photon / OpenStreetMap.</p>
    <nav aria-label="Localização selecionada" className="locationBreadcrumb">{LOCATION_LEVELS.map((level) => selection[level]?.name).filter(Boolean).join(' › ') || 'Nenhuma localização selecionada'}</nav>
    {feedback && <small role="status">{feedback}</small>}
    {savedLocations.length > 0 && <label className="locationSaved">Localizações salvas no case<select value="" onChange={(event) => { if (event.currentTarget.value) onRestore(event.currentTarget.value); }}><option value="">Escolher localização salva</option>{savedLocations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    {LOCATION_LEVELS.map((level, index) => <LocationField key={`${reset}:${level}:${LOCATION_LEVELS.slice(0, index).map((parent) => selection[parent]?.id ?? '').join(':')}`} active={open && active} level={level} selection={selection} countries={countries} regions={regions} onSelect={(result) => onSelect(level, result)} />)}
    <label><input type="checkbox" checked={autoZoom} onChange={(event) => onAutoZoom(event.currentTarget.checked)} /> Aproximar automaticamente</label>
    <button type="button" disabled={!selection.country} onClick={onMarker}>Criar marcador da seleção</button>
    <button type="button" disabled={!selection.country || !caseName || busy} onClick={onSave}>{busy ? 'Salvando…' : `Salvar localização${caseName ? ` em ${caseName}` : ' no case'}`}</button>
    <button className="locationClear" type="button" onClick={() => { onClear(); setReset((value) => value + 1); }}>Limpar localização</button>
    <small>Limites: Natural Earth (domínio público), IBGE (dados públicos, atribuição) e Prefeitura do Recife (ODbL, atribuição). Busca: © OpenStreetMap contributors · ODbL / Photon. Bairros e vias oficiais disponíveis apenas para Recife; a via completa pode atravessar outros bairros.</small>
  </section>;
}
