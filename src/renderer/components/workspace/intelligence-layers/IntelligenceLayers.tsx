import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { INTELLIGENCE_CATEGORIES } from '../../../../shared/intelligence-layers/intelligence-types';
import type { IntelligenceCategory, IntelligencePoint, IntelligenceResponse } from '../../../../shared/intelligence-layers/intelligence-types';
import { isAllowedBounds, pointInTerritory, territoryBounds } from '../../../../shared/intelligence-layers/spatial';
import type { CaseActivityCreateInput, InvestigationCase } from '../../../../shared/cases/cases.types';
import type { LocationSelection } from '../location-selection';
import { IntelligenceMap } from './IntelligenceMap';
import { selectedIntelligenceArea } from './intelligence-area';
const labelFor = (id: IntelligenceCategory) => INTELLIGENCE_CATEGORIES.find((item) => item.id === id)?.label ?? id;
const pointLabel = (point: IntelligencePoint) => point.name ?? 'Nome não informado';
const EMPTY_POINTS: IntelligencePoint[] = [];

export function IntelligenceLayers({ map, active, open, visible, selection, activeCase, caseBusy, onClose, onInspectorChange, onCountChange, onCreateMarker, addActivity }: { map: MapLibreMap | null; active: boolean; open: boolean; visible: boolean; selection: LocationSelection; activeCase: InvestigationCase | null; caseBusy: boolean; onClose(): void; onInspectorChange(open: boolean): void; onCountChange(count: number): void; onCreateMarker(point: IntelligencePoint): void; addActivity(input: CaseActivityCreateInput): Promise<unknown> }) {
  const area = useMemo(() => selectedIntelligenceArea(selection), [selection]);
  const [categories, setCategories] = useState<IntelligenceCategory[]>(['health']);
  const [loadedCategories, setLoadedCategories] = useState<IntelligenceCategory[]>([]);
  const [response, setResponse] = useState<IntelligenceResponse | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<IntelligencePoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const request = useRef<{ id: string; token: number } | null>(null);
  const generation = useRef(0);
  const saveLock = useRef(false);
  const areaRef = useRef(area); areaRef.current = area;
  const onInspectorRef = useRef(onInspectorChange); onInspectorRef.current = onInspectorChange;
  const onCountRef = useRef(onCountChange); onCountRef.current = onCountChange;
  const points = useMemo(() => response && area ? response.points.filter((point) => pointInTerritory([point.longitude, point.latitude], area.geometry)) : [], [response, area]);
  const visiblePoints = useMemo(() => { const query = search.trim().toLocaleLowerCase('pt-BR'); return points.filter((point) => categories.includes(point.category) && (!query || (point.name ?? '').toLocaleLowerCase('pt-BR').includes(query))); }, [points, categories, search]);
  const bounds = area ? territoryBounds(area.geometry) : null;
  const inspectorTarget = map?.getContainer().closest('.worldGlobeMap')?.querySelector<HTMLElement>('.worldGlobeInspector') ?? null;
  const saved = Boolean(activeCase && selected && activeCase.activities.some((activity) => activity.action === 'intelligence-poi-saved' && typeof activity.input === 'object' && activity.input !== null && 'sourceId' in activity.input && activity.input.sourceId === selected.id));
  useEffect(() => { onCountRef.current(points.length); }, [points.length]);

  useEffect(() => {
    generation.current += 1;
    const previous = request.current; request.current = null;
    if (previous) void window.zeroHub.intelligenceLayers.cancel(previous.id).catch((): void => { /* Request was discarded. */ });
    setBusy(false); setResponse(null); setLoadedCategories([]); setSelected(null); setConfirmId(null); setMessage(''); onInspectorRef.current(false);
  }, [area?.id, area?.geometry]);
  useEffect(() => () => { generation.current += 1; const previous = request.current; request.current = null; if (previous) void window.zeroHub.intelligenceLayers.cancel(previous.id).catch((): void => { /* Request was discarded. */ }); }, []);
  useEffect(() => { setConfirmId(null); }, [activeCase?.id]);
  useEffect(() => { if (selected && !visiblePoints.some((point) => point.id === selected.id)) { setSelected(null); setConfirmId(null); onInspectorRef.current(false); } }, [selected, visiblePoints]);

  const select = (point: IntelligencePoint) => {
    setSelected(point); setConfirmId(null); setCopyStatus(''); onInspectorChange(true);
    map?.flyTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), 15), duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450, essential: false });
  };
  const cancel = () => { const previous = request.current; generation.current += 1; request.current = null; setBusy(false); setMessage('Consulta cancelada.'); if (previous) void window.zeroHub.intelligenceLayers.cancel(previous.id).catch((): void => { /* Request was discarded. */ }); };
  const query = () => {
    if (!area || !bounds || !isAllowedBounds(bounds) || !categories.length || request.current) return;
    const id = crypto.randomUUID(), token = ++generation.current, chosen = [...categories]; request.current = { id, token }; setBusy(true); setMessage('Consultando OpenStreetMap…');
    void window.zeroHub.intelligenceLayers.query({ requestId: id, bbox: bounds, categories: chosen }).then((result) => {
      if (generation.current !== token || areaRef.current?.id !== area.id || areaRef.current?.geometry !== area.geometry) return;
      setResponse(result); setLoadedCategories(chosen); setSelected(null); onInspectorRef.current(false); setMessage(result.cached ? 'Resultado recuperado do cache local da sessão.' : 'Consulta concluída.');
    }).catch((error: unknown) => { if (generation.current !== token) return; const raw = error instanceof Error ? error.message : ''; const text = raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, ''); setMessage(text && !/failed to fetch|network|ERR_|AbortError|aborted/i.test(text) ? text.slice(0, 240) : 'Servidor Overpass indisponível ou tempo esgotado. Tente novamente mais tarde.'); }).finally(() => { if (generation.current === token) { request.current = null; setBusy(false); } });
  };
  const save = async () => {
    if (!selected || !activeCase || saved || caseBusy || saveLock.current || confirmId !== selected.id) return;
    saveLock.current = true; setSaving(true); const point = selected; const caseId = activeCase.id;
    try { await addActivity({ caseId, moduleId: 'map-workspace', action: 'intelligence-poi-saved', title: `Ponto OSM: ${pointLabel(point)}`.slice(0, 180), status: 'success', input: { sourceId: point.id }, output: { ...point, fetchedAt: response?.fetchedAt ?? null, dataTimestamp: response?.dataTimestamp ?? null } }); setMessage('Ponto registrado no case.'); setConfirmId(null); } catch { setMessage('Não foi possível registrar o ponto no case.'); } finally { saveLock.current = false; setSaving(false); }
  };
  const address = selected ? [selected.tags['addr:street'], selected.tags['addr:housenumber'], selected.tags['addr:city'], selected.tags['addr:postcode']].filter(Boolean).join(', ') : '';
  return <>
    <IntelligenceMap map={visible && visiblePoints.length > 0 ? map : null} points={visible ? visiblePoints : EMPTY_POINTS} selectedId={selected?.id ?? null} onSelect={select} />
    {map && visible && visiblePoints.length > 0 && createPortal(<span className="intelligenceMapAttribution">© OpenStreetMap contributors · ODbL · openstreetmap.org/copyright</span>, map.getContainer())}
    <section className="intelligencePanel" id="intelligence-layers-panel" hidden={!open} aria-label="Intelligence Layers">
      <header><div><small>INTELIGÊNCIA TERRITORIAL</small><strong>Intelligence Layers</strong></div><button type="button" onClick={onClose} aria-label="Recolher Intelligence Layers">−</button></header>
      <p className="intelligenceRegion">{area ? <><b>{area.name}</b><br />Limite: {area.source}</> : 'Selecione uma região com geometria disponível no painel de localização.'}</p>
      {area && (!bounds || !isAllowedBounds(bounds)) && <p className="intelligenceWarning">Área grande demais ou antimeridiano não suportado. Selecione uma região menor; para grandes áreas, use extratos locais ou infraestrutura própria.</p>}
      <details open><summary>Categorias <span>{categories.length} ativas</span></summary>
        {INTELLIGENCE_CATEGORIES.map((category) => <label className="intelligenceCategory" key={category.id}><input type="checkbox" checked={categories.includes(category.id)} onChange={() => setCategories((current) => current.includes(category.id) ? current.filter((item) => item !== category.id) : [...current, category.id])} /><i style={{ background: category.color }} /><span>{category.label}</span><small>{loadedCategories.includes(category.id) ? points.filter((point) => point.category === category.id).length : 'não consultada'}</small></label>)}
      </details>
      <div className="intelligenceActions"><button type="button" disabled={!active || !area || !bounds || !isAllowedBounds(bounds) || !categories.length || busy} onClick={query}>Consultar região</button>{busy && <button type="button" onClick={cancel}>Cancelar</button>}<button type="button" disabled={!response && !busy} onClick={() => { if (busy) cancel(); setResponse(null); setLoadedCategories([]); setSelected(null); onInspectorChange(false); setMessage('Camadas limpas.'); }}>Limpar</button></div>
      <p className="intelligenceStatus" role="status">{message || 'Consulta manual: a caixa da região e as categorias são enviadas ao Overpass.'}</p>
      {!visible && <p className="intelligenceWarning">Camada oculta no gerenciador de camadas.</p>}
      <label className="intelligenceSearch"><span>Pesquisar por nome</span><input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Nome do estabelecimento" /></label>
      <div className="intelligenceListHeader"><strong>Resultados</strong><span>{visiblePoints.length} visíveis · {points.length} na região</span></div>
      {!response && <p className="intelligenceEmpty">Selecione categorias e consulte a região. A cobertura OSM pode ser incompleta.</p>}
      {response && visiblePoints.length === 0 && <p className="intelligenceEmpty">{points.length === 0 ? 'Nenhum estabelecimento encontrado na região para as categorias consultadas.' : 'Nenhum resultado para os filtros ativos.'}</p>}
      <div className="intelligenceList">{visiblePoints.slice(0, 80).map((point) => { const category = INTELLIGENCE_CATEGORIES.find((item) => item.id === point.category); return <button type="button" key={point.id} aria-pressed={selected?.id === point.id} onClick={() => select(point)}><i style={{ background: category?.color }} /><span>{pointLabel(point)}<small>{category?.label} · {point.id}</small></span></button>; })}</div>
      {visiblePoints.length > 80 && <p className="intelligenceStatus">Mostrando 80 na lista; use a busca para localizar os demais.</p>}
      <p className="intelligenceAttribution">© OpenStreetMap contributors · ODbL 1.0 · openstreetmap.org/copyright<br />{response ? `Consultado: ${new Date(response.fetchedAt).toLocaleString('pt-BR')}${response.dataTimestamp ? ` · Base: ${new Date(response.dataTimestamp).toLocaleString('pt-BR')}` : ''}` : 'Sem consulta nesta região.'}</p>
    </section>
    {selected && inspectorTarget && createPortal(<section className="intelligenceInspector" aria-label="Detalhes do ponto de interesse">
      <header><div><small>PONTO DE INTERESSE</small><strong>{pointLabel(selected)}</strong></div><button type="button" aria-label="Fechar detalhes do ponto" onClick={() => { setSelected(null); setConfirmId(null); onInspectorChange(false); }}>×</button></header>
      <dl><div><dt>Categoria</dt><dd>{labelFor(selected.category)}</dd></div><div><dt>Coordenadas</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd></div><div><dt>Endereço</dt><dd>{address || 'Não informado'}</dd></div><div><dt>Identificador</dt><dd>{selected.id}</dd></div><div><dt>Fonte e licença</dt><dd>OpenStreetMap · ODbL 1.0</dd></div><div><dt>Precisão</dt><dd>{selected.representation === 'node' ? 'Coordenada do nó OSM; precisão não verificada.' : 'Centro da caixa do objeto OSM; localização aproximada e pode estar fora da geometria do objeto.'}</dd></div><div><dt>Dados</dt><dd>{Object.entries(selected.tags).filter(([key]) => key !== 'name').map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Sem outros atributos disponíveis'}</dd></div><div><dt>Consulta e atualização</dt><dd>{response ? `Consultado: ${new Date(response.fetchedAt).toLocaleString('pt-BR')}` : 'Consulta não informada'}{response?.dataTimestamp ? ` · Base: ${new Date(response.dataTimestamp).toLocaleString('pt-BR')}` : ' · Data da base não informada'}</dd></div></dl>
      <div className="intelligenceActions"><button type="button" onClick={() => { void window.zeroHub.clipboard.writeText(`${selected.latitude}, ${selected.longitude}`).then(() => setCopyStatus('Coordenadas copiadas.')).catch(() => setCopyStatus('Não foi possível copiar.')); }}>Copiar</button><button type="button" onClick={() => select(selected)}>Centralizar</button><button type="button" onClick={() => { onCreateMarker(selected); setCopyStatus('Marcador criado.'); }}>Criar marcador</button></div>
      {confirmId === selected.id ? <div className="intelligenceConfirm"><span>Registrar este ponto em {activeCase?.name}?</span><button type="button" disabled={saving || caseBusy || !activeCase} onClick={() => { void save(); }}>Confirmar registro</button><button type="button" onClick={() => setConfirmId(null)}>Cancelar</button></div> : <button type="button" disabled={!activeCase || caseBusy || saving || saved} onClick={() => setConfirmId(selected.id)}>{saved ? 'Já registrado no case' : 'Registrar no case'}</button>}
      {!activeCase && <small>Selecione um case para registrar; a consulta funciona sem case.</small>}
      <p role="status">{copyStatus || message}</p>
    </section>, inspectorTarget)}
  </>;
}
