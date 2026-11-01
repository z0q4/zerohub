import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { bearingDegrees, destinationCoordinate, distanceMeters } from '../geo-measurement';
import type { GeographicCoordinate } from '../geo-measurement';
import { SignalLabMap } from './SignalLabMap';
import { signalFeatures } from './signal-geometry';
import { isSignalStationValid, solveSignal, uncertaintyExceedsStationScale } from './signal-math';
import type { SignalMode, SignalStation } from './signal-math';

type DraftStation = { id: string; lat: string; lon: string; measurement: string; sigma: string };
const demoTarget: GeographicCoordinate = [-34.88, -8.07];
const number = (value: string) => value.trim() === '' ? NaN : Number(value);
function demoStations(mode: SignalMode): DraftStation[] {
  return [15, 145, 255].map((bearing, index) => {
    const coordinate = destinationCoordinate(demoTarget, [3500, 4200, 5100][index], bearing);
    return { id: `demo-${index}`, lat: String(coordinate[1]), lon: String(coordinate[0]), measurement: String(mode === 'distance' ? distanceMeters(coordinate, demoTarget) : bearingDegrees(coordinate, demoTarget)), sigma: mode === 'distance' ? '50' : '2' };
  });
}
function stationFromDraft(draft: DraftStation, index: number): SignalStation {
  return { id: draft.id, label: String.fromCharCode(65 + index), coordinate: [number(draft.lon), number(draft.lat)], measurement: number(draft.measurement), sigma: number(draft.sigma) };
}

export function SignalLab({ map, active }: { map: MapLibreMap | null; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SignalMode>('distance');
  const [drafts, setDrafts] = useState<Record<SignalMode, DraftStation[]>>({ distance: [], bearing: [] });
  const [placing, setPlacing] = useState(false);
  const [demoModes, setDemoModes] = useState<Record<SignalMode, boolean>>({ distance: false, bearing: false });
  const demo = demoModes[mode];
  const setDemo = (value: boolean) => setDemoModes((current) => ({ ...current, [mode]: value }));
  const [animate, setAnimate] = useState(true);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const serial = useRef(0);
  const cameraAnimation = useRef(false);
  const stationCards = useRef(new Map<string, HTMLFieldSetElement>());
  const currentDrafts = drafts[mode];
  const stations = useMemo(() => currentDrafts.map(stationFromDraft), [currentDrafts]);
  const drawable = useMemo(() => stations.filter((s) => Number.isFinite(s.coordinate[0]) && Number.isFinite(s.coordinate[1]) && Math.abs(s.coordinate[0]) <= 180 && Math.abs(s.coordinate[1]) <= 85), [stations]);
  const result = useMemo(() => solveSignal(mode, stations), [mode, stations]);
  const validCount = stations.filter((station) => isSignalStationValid(mode, station)).length;
  const geometryOmitted = useMemo(() => signalFeatures(mode, drawable, result.solution, progress).omitted, [mode, drawable, result.solution, progress]);
  const stopLabAnimation = () => {
    setPlaying(false);
    if (cameraAnimation.current && map?.isMoving()) map.stop();
    cameraAnimation.current = false;
  };

  useEffect(() => {
    if (!map) return undefined;
    const onMoveEnd = () => { cameraAnimation.current = false; };
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [map]);

  useEffect(() => {
    if (!open || !selectedId) return undefined;
    const frame = window.requestAnimationFrame(() => stationCards.current.get(selectedId)?.scrollIntoView({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedId]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!playing || !open || !active) return undefined;
    if (reduced || !animate) { setProgress(1); setPlaying(false); return undefined; }
    const timer = window.setInterval(() => setProgress((current) => {
      const next = Math.min(1, current + 0.05);
      if (next >= 1) window.clearInterval(timer);
      return next;
    }), 100);
    return () => window.clearInterval(timer);
  }, [playing, open, active, reduced, animate]);
  useEffect(() => { if (progress >= 1) setPlaying(false); }, [progress]);
  useEffect(() => {
    if (!map || !open) return undefined;
    const workspace = map.getContainer().closest('.worldGlobeMap');
    if (!workspace) return undefined;
    const onToolClick = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.mapMeasurementToggle, .mapGeoJsonToggle, .mapComparisonToggle')) {
        setOpen(false); setPlacing(false); stopLabAnimation();
      }
    };
    workspace.addEventListener('click', onToolClick);
    return () => workspace.removeEventListener('click', onToolClick);
  }, [map, open]);
  useEffect(() => {
    if (!map || !placing || !active || !open) return undefined;
    const onClick = (event: MapMouseEvent) => {
      if (event.originalEvent.ctrlKey || !Number.isFinite(event.lngLat.lng) || !Number.isFinite(event.lngLat.lat) || Math.abs(event.lngLat.lat) > 85 || Math.abs(event.lngLat.lng) > 180) return;
      if (map.getContainer().closest('.worldGlobeMap')?.querySelector('.mapMeasurementModes button[aria-pressed="true"]')) { setPlacing(false); setNotice('Desative a ferramenta de medição antes de posicionar uma estação.'); return; }
      const station: DraftStation = { id: `manual-${++serial.current}`, lat: String(event.lngLat.lat), lon: String(event.lngLat.lng), measurement: '', sigma: mode === 'distance' ? '50' : '2' };
      setDrafts((current) => ({ ...current, [mode]: [...current[mode], station] }));
      setSelectedId(station.id); setPlacing(false); setNotice(''); setPlaying(false); setProgress(1);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, placing, active, open, mode]);
  const update = (id: string, key: keyof Omit<DraftStation, 'id'>, value: string) => {
    setDrafts((current) => ({ ...current, [mode]: current[mode].map((station) => station.id === id ? { ...station, [key]: value } : station) }));
    setPlaying(false); setProgress(1);
  };
  const closeOtherToolPanels = () => {
    map?.getContainer().closest('.worldGlobeMap')?.querySelectorAll<HTMLButtonElement>('.mapMeasurementToggle[aria-expanded="true"], .mapGeoJsonToggle[aria-expanded="true"], .mapComparisonToggle[aria-expanded="true"]').forEach((button) => button.click());
  };
  const fitPoints = (points: GeographicCoordinate[]) => {
    if (!map || !points.length) return;
    const base = points[0][0];
    const longitudes = points.map(([lon]) => base + ((lon - base + 540) % 360) - 180);
    const latitudes = points.map(([, lat]) => lat);
    const right = Math.min(390, Math.max(20, map.getCanvas().clientWidth - 100));
    cameraAnimation.current = true;
    map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: { left: 25, right, top: 35, bottom: 35 }, maxZoom: 15, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 });
  };
  const startDemo = () => {
    const scenario = demoStations(mode);
    setDrafts((current) => ({ ...current, [mode]: scenario }));
    setDemo(true); setPlacing(false); setSelectedId(null); setNotice('');
    const reducedNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(reducedNow);
    const animated = animate && !reducedNow;
    setProgress(animated ? 0 : 1); setPlaying(animated);
    fitPoints([...scenario.map((station, index) => stationFromDraft(station, index).coordinate), demoTarget]);
  };
  const fitAnalysis = () => {
    const points = drawable.map((station) => station.coordinate);
    if (result.solution && progress >= 1) points.push(result.solution.coordinate);
    fitPoints(points);
  };

  return <>
    <SignalLabMap map={map} mode={mode} stations={drawable} solution={result.solution} progress={progress} selectedId={selectedId} onSelectStation={(id) => { if (!open) closeOtherToolPanels(); setSelectedId(id); setOpen(true); setPlacing(false); setPlaying(false); }} />
    <button className="signalLabToggle" type="button" aria-label={open ? 'Recolher GEOINT Signal Lab' : 'Abrir GEOINT Signal Lab'} aria-expanded={open} aria-controls="signal-lab" title="GEOINT Signal Lab · análise de medições" onClick={() => { if (!open) closeOtherToolPanels(); setOpen((value) => !value); setPlacing(false); stopLabAnimation(); }}>GEO</button>
    {open && <section id="signal-lab" className="signalLabPanel" aria-label="GEOINT Signal Lab">
      <header><div><small>GEOINT · ANÁLISE LOCAL</small><strong>Signal Lab</strong><span className="signalLabHeaderStatus">{mode === 'distance' ? 'Trilateração' : 'Triangulação'} · {validCount}/{stations.length} medições válidas</span></div><button type="button" aria-label="Fechar Signal Lab" onClick={() => { setOpen(false); setPlacing(false); stopLabAnimation(); }}>×</button></header>
      <p>Estimativas experimentais com medições fornecidas pelo usuário.</p>
      <div className="signalLabModes" aria-label="Método de análise">
        <button type="button" aria-pressed={mode === 'distance'} onClick={() => { setMode('distance'); setSelectedId(null); setNotice(''); setPlacing(false); setPlaying(false); setProgress(1); }}>Trilateração</button>
        <button type="button" aria-pressed={mode === 'bearing'} onClick={() => { setMode('bearing'); setSelectedId(null); setNotice(''); setPlacing(false); setPlaying(false); setProgress(1); }}>Triangulação</button>
      </div>
      <p>{mode === 'distance' ? 'Distâncias estimadas até o alvo, em metros.' : 'Azimutes em graus, medidos no sentido horário a partir do norte.'}</p>
      <div className="signalLabActions"><button type="button" disabled={!map || !active || currentDrafts.length >= 8} aria-pressed={placing} title="Clique no mapa para adicionar uma estação" onClick={() => { if (!placing && map?.getContainer().closest('.worldGlobeMap')?.querySelector('.mapMeasurementModes button[aria-pressed="true"]')) { setNotice('Desative a ferramenta de medição antes de posicionar uma estação.'); return; } setNotice(''); setPlacing((current) => !current); }}>{placing ? 'Cancelar seleção' : '+ Estação no mapa'}</button><button type="button" onClick={startDemo}>Iniciar demonstração</button><button type="button" disabled={!drawable.length || !map} onClick={fitAnalysis} title="Enquadrar estações e posição estimada">Enquadrar</button></div>
      {placing && <p className="signalLabNotice" role="status">Clique no mapa para posicionar a estação.</p>}
      {notice && <p className="signalLabNotice" role="status">{notice}</p>}
      {demo && <p className="signalLabNotice">DADOS SIMULADOS · cenário demonstrativo</p>}
      <div className="signalLabActions"><button type="button" onClick={() => { setAnimate((value) => !value); setPlaying(false); setProgress(1); }} title="Revela apenas as geometrias calculadas; não é rastreamento em tempo real">{animate ? 'Visualização animada' : 'Visualização estática'}</button><button type="button" disabled={!demo} onClick={startDemo}>Reiniciar</button><button type="button" disabled={!demo || progress >= 1 || reduced || !animate} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pausar' : 'Continuar'}</button><button type="button" onClick={() => { setDrafts((current) => ({ ...current, [mode]: [] })); setDemo(false); setSelectedId(null); setNotice(''); setPlacing(false); setPlaying(false); setProgress(1); }}>Limpar</button></div>
      <div className="signalLabResult" role="status">
        {result.solution && progress >= 1 ? <><strong>Posição estimada</strong><span className="signalLabResultCoordinates">{result.solution.coordinate[1].toFixed(6)}, {result.solution.coordinate[0].toFixed(6)}</span><span>Raio conservador ≈ {result.solution.uncertaintyMeters.toFixed(0)} m</span><span title="RMS dos resíduos dividido pelas incertezas 1σ; o motor rejeita valores acima de 3">Ajuste compatível · RMS normalizado {result.solution.normalizedRms.toFixed(2)}</span><small>≈95% sob erros independentes normais e incertezas 1σ informadas; aproximação local, sem garantia da posição real.</small></> : <span>{result.error ?? 'Formando as medições…'}</span>}
        {result.solution && progress >= 1 && uncertaintyExceedsStationScale(stations, result.solution) && <small className="signalLabWarning">Estimativa pouco localizada: o raio de incerteza é igual ou maior que a distância mediana às estações.</small>}
        {geometryOmitted && <small>Geometria que cruza o antimeridiano não é desenhada neste MVP.</small>}
      </div>
      <div className="signalLabLegend" aria-label="Legenda da análise"><span><i />Estação</span><span><i />{mode === 'distance' ? 'Distância' : 'Azimute →'}</span><span><i />Incerteza aproximada</span></div>
      {!currentDrafts.length && <p className="signalLabEmpty">Adicione estações no mapa ou inicie uma demonstração com dados simulados.</p>}
      <div className="signalLabStations">
        {currentDrafts.map((station, index) => <fieldset key={station.id} data-selected={selectedId === station.id} ref={(element) => { if (element) stationCards.current.set(station.id, element); else stationCards.current.delete(station.id); }} onFocus={() => setSelectedId(station.id)}>
          <legend><button type="button" aria-pressed={selectedId === station.id} onClick={() => setSelectedId(station.id)}>Estação {String.fromCharCode(65 + index)}</button></legend>
          <span className="signalStationState" data-valid={isSignalStationValid(mode, stations[index])}>{isSignalStationValid(mode, stations[index]) ? 'Medição válida' : 'Dados incompletos ou inválidos'}</span>
          <button className="signalLabRemove" type="button" aria-label={`Remover estação ${index + 1}`} onClick={() => { setDrafts((current) => ({ ...current, [mode]: current[mode].filter((item) => item.id !== station.id) })); if (selectedId === station.id) setSelectedId(null); setPlaying(false); setProgress(1); }}>×</button>
          <div className="signalLabFields">
            <label>Latitude<input type="number" step="any" aria-label={`Latitude estação ${index + 1}`} aria-invalid={!Number.isFinite(stations[index].coordinate[1]) || Math.abs(stations[index].coordinate[1]) > 85} title="Latitude entre −85° e 85°" value={station.lat} onChange={(e) => update(station.id, 'lat', e.target.value)} /></label>
            <label>Longitude<input type="number" step="any" aria-label={`Longitude estação ${index + 1}`} aria-invalid={!Number.isFinite(stations[index].coordinate[0]) || Math.abs(stations[index].coordinate[0]) > 180} title="Longitude entre −180° e 180°" value={station.lon} onChange={(e) => update(station.id, 'lon', e.target.value)} /></label>
            <label>{mode === 'distance' ? 'Distância (m)' : 'Azimute (°)'}<input type="number" step="any" aria-label={`${mode === 'distance' ? 'Distância' : 'Azimute'} estação ${index + 1}`} aria-invalid={!Number.isFinite(stations[index].measurement) || (mode === 'distance' ? stations[index].measurement <= 0 || stations[index].measurement > 100_000 : stations[index].measurement < 0 || stations[index].measurement >= 360)} title={mode === 'distance' ? 'Distância positiva de até 100 km' : 'Azimute de 0° até menos de 360°, a partir do norte'} value={station.measurement} onChange={(e) => update(station.id, 'measurement', e.target.value)} /></label>
            <label>Incerteza 1σ ({mode === 'distance' ? 'm' : '°'})<input type="number" step="any" min="0" aria-label={`Incerteza estação ${index + 1}`} aria-invalid={!Number.isFinite(stations[index].sigma) || stations[index].sigma <= 0} title="Desvio padrão positivo informado pelo usuário" value={station.sigma} onChange={(e) => update(station.id, 'sigma', e.target.value)} /></label>
          </div>
          {result.solution && progress >= 1 && <small className="signalStationResidual">Resíduo: {result.solution.residuals[index].toFixed(mode === 'distance' ? 1 : 2)} {mode === 'distance' ? 'm' : '°'} · previsto − informado</small>}
        </fieldset>)}
      </div>
    </section>}
  </>;
}
