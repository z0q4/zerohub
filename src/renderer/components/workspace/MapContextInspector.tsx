import { useState } from 'react';
import { LOCATION_LEVELS } from './location-selection';
import type { LocationSelection } from './location-selection';
import type { GeographicMarker } from './map-workspace.types';

export function MapContextInspector({ marker, selection, caseName, onClose }: { marker: GeographicMarker | null; selection: LocationSelection; caseName: string | null; onClose(): void }) {
  const [copyResult, setCopyResult] = useState<{ coordinates: string; ok: boolean } | null>(null);
  const selected = [...LOCATION_LEVELS].reverse().map((level) => selection[level]).find(Boolean);
  if (!marker && !selected) return null;
  const item = marker ?? selected;
  if (!item) return null;
  const source = marker ? marker.saved ? 'Marcador salvo no case' : 'Marcador transitório' : selected?.geometryMetadata?.source ?? selected?.attribution ?? 'Fonte indisponível';
  const precision = marker ? 'Coordenadas do marcador' : selected?.sourceId === 'user-coordinate' ? 'Coordenada informada; vínculo não verificado' : selected?.approximate ? 'Coordenada aproximada' : 'Coordenada informada pela fonte';
  const coordinates = `${item.latitude}, ${item.longitude}`;
  const copyFeedback = copyResult?.coordinates === coordinates ? copyResult : null;
  return <section className="mapContextInspector" aria-label="Detalhes da seleção">
    <header><div><span>INSPECTOR</span><strong>{marker ? 'Marcador' : 'Localização'}</strong></div><button type="button" onClick={onClose} aria-label="Recolher detalhes da seleção">−</button></header>
    <h2>{item.name}</h2>
    {!marker && <p>{LOCATION_LEVELS.map((level) => selection[level]?.name).filter(Boolean).join(' › ')}</p>}
    <dl>
      <div><dt>Coordenadas</dt><dd className="mapInspectorCoordinates"><span>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</span><button type="button" aria-label="Copiar coordenadas com precisão original" title="Copiar coordenadas com precisão original" onClick={() => { void window.zeroHub.clipboard.writeText(coordinates).then(() => setCopyResult({ coordinates, ok: true })).catch(() => setCopyResult({ coordinates, ok: false })); }}>Copiar</button></dd><small className="mapInspectorCopyFeedback" role="status">{copyFeedback ? copyFeedback.ok ? 'Coordenadas copiadas' : 'Não foi possível copiar' : ''}</small></div>
      <div><dt>Fonte</dt><dd>{source}</dd></div>
      <div><dt>Precisão</dt><dd>{precision}</dd></div>
      {marker && <div><dt>Categoria</dt><dd>{marker.category}</dd></div>}
      {caseName && <div><dt>Case ativo</dt><dd>{caseName}</dd></div>}
    </dl>
  </section>;
}
