import {
  useEffect,
} from 'react';

import type {
  GeographicSearchResult,
} from '../../../shared/geographic-search/geographic-search.types';

type GeographicSearchResultPanelProps = {
  busy: boolean;
  copied: boolean;
  favorite: boolean;
  result: GeographicSearchResult | null;

  onCenter(): void;
  onClear(): void;
  onCopy(): void;
  onReverse(): void;
  onSaveMarker(): void;
  onToggleFavorite(): void;
};

const TYPE_LABELS = {
  address: 'Endereço',
  street: 'Via',
  neighbourhood: 'Bairro',
  city: 'Cidade',
  region: 'Região',
  country: 'País',
  poi: 'Ponto de interesse',
  coordinate: 'Coordenada',
  unknown: 'Local',
} as const;

export function GeographicSearchResultPanel({
  busy,
  copied,
  favorite,
  onCenter,
  onClear,
  onCopy,
  onReverse,
  onSaveMarker,
  onToggleFavorite,
  result,
}: GeographicSearchResultPanelProps) {
  useEffect(() => {
    if (!result) {
      return undefined;
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        onClear();
      }
    };
    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [onClear, result]);

  if (!result) {
    return null;
  }

  return (
    <aside
      className="geographicSearchResultPanel"
      aria-label="Resultado geográfico transitório"
      aria-busy={busy}
    >
      <header>
        <div>
          <span>BUSCA GEOGRÁFICA</span>
          <strong>{result.name}</strong>
        </div>
        <button
          type="button"
          aria-label="Fechar resultado geográfico"
          onClick={onClear}
        >
          ×
        </button>
      </header>

      <p>{result.label}</p>

      <dl>
        <div>
          <dt>Tipo</dt>
          <dd>{TYPE_LABELS[result.type]}</dd>
        </div>
        <div>
          <dt>Precisão</dt>
          <dd>Localização aproximada</dd>
        </div>
        <div>
          <dt>Coordenadas</dt>
          <dd>
            {result.latitude.toFixed(5)},
            {' '}
            {result.longitude.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>
            {result.provider === 'local'
              ? 'Entrada local'
              : 'Photon / OpenStreetMap'}
          </dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>
            {result.cached
              ? 'Cache local recente'
              : result.provider === 'local'
                ? 'Sem consulta externa'
                : 'Consulta externa concluída'}
          </dd>
        </div>
        {(result.city || result.region || result.country) && (
          <div>
            <dt>Contexto</dt>
            <dd>
              {[
                result.city,
                result.region,
                result.country,
              ].filter(Boolean).join(' · ')}
            </dd>
          </div>
        )}
      </dl>

      <div className="geographicSearchResultActions">
        <button type="button" onClick={onCenter}>
          Centralizar
        </button>
        <button type="button" onClick={onCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" onClick={onSaveMarker}>
          Salvar como marcador
        </button>
        <button
          type="button"
          aria-pressed={favorite}
          onClick={onToggleFavorite}
        >
          {favorite
            ? 'Remover favorito'
            : 'Favoritar'}
        </button>
        <button
          type="button"
          disabled={busy}
          title="Envia somente esta coordenada ao Photon para procurar um endereço aproximado"
          onClick={onReverse}
        >
          {busy
            ? 'Consultando endereço…'
            : 'Buscar endereço aproximado'}
        </button>
      </div>

      <small>
        {result.attribution}. O resultado não representa precisão medida.
      </small>
    </aside>
  );
}
