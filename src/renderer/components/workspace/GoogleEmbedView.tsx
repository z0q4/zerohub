import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  GoogleEmbedMode,
} from '../../../shared/map-providers/map-providers.types';
import { parseGoogleCoordinate } from '../../../shared/map-providers/map-providers.validation';

type GoogleEmbedViewProps = {
  configured: boolean;
  initialLatitude: number;
  initialLongitude: number;
  initialZoom: number;
  mode: GoogleEmbedMode;

  onConfigure(): void;
  onReturnToMap(): void;
};

export function GoogleEmbedView({
  configured,
  initialLatitude,
  initialLongitude,
  initialZoom,
  mode,
  onConfigure,
  onReturnToMap,
}: GoogleEmbedViewProps) {
  const [latitude, setLatitude] =
    useState(
      initialLatitude.toFixed(6),
    );
  const [longitude, setLongitude] =
    useState(
      initialLongitude.toFixed(6),
    );
  const [sessionUrl, setSessionUrl] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [revision, setRevision] =
    useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!configured) {
      setSessionUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const requestId =
      requestIdRef.current + 1;
    requestIdRef.current = requestId;

    async function load():
      Promise<void> {
      setLoading(true);
      setError(null);
      setSessionUrl(null);

      try {
        const parsedLatitude =
          parseGoogleCoordinate(
            latitude,
            'A latitude',
            -90,
            90,
          );
        const parsedLongitude =
          parseGoogleCoordinate(
            longitude,
            'A longitude',
            -180,
            180,
          );
        const session =
          await window.zeroHub
            .mapProviders
            .createGoogleEmbed({
              mode,
              latitude:
                parsedLatitude,
              longitude:
                parsedLongitude,
              zoom: Math.max(
                0,
                Math.min(
                  21,
                  initialZoom,
                ),
              ),
            });

        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        setSessionUrl(session.url);
      } catch (unknownError) {
        if (!cancelled) {
          setSessionUrl(null);
          setLoading(false);
          setError(
            unknownError instanceof Error
              ? unknownError.message
              : 'Não foi possível abrir a vista do Google.',
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    configured,
    initialZoom,
    mode,
    revision,
  ]);

  useEffect(() => {
    if (!loading || !sessionUrl) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setLoading(false);
        setError(
          'O Google não respondeu dentro do tempo esperado. Verifique a conexão, a cota, o faturamento e as restrições da chave.',
        );
      },
      15_000,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loading, sessionUrl]);

  function reload(): void {
    setRevision(
      (current) => current + 1,
    );
  }

  return (
    <section
      className="googleEmbedView"
      aria-label={
        mode === 'map-2d'
          ? 'Google Maps 2D'
          : 'Google Street View 360 graus'
      }
    >
      <header className="googleEmbedToolbar">
        <div>
          <strong>
            {mode === 'map-2d'
              ? 'GOOGLE MAPS · 2D'
              : 'GOOGLE STREET VIEW · 360°'}
          </strong>
          <span>
            Vista externa isolada · câmera e overlays não são sincronizados
          </span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            reload();
          }}
        >
          <label>
            <span>LAT</span>
            <input
              inputMode="decimal"
              value={latitude}
              onChange={(event) => {
                setLatitude(
                  event.target.value,
                );
              }}
            />
          </label>
          <label>
            <span>LON</span>
            <input
              inputMode="decimal"
              value={longitude}
              onChange={(event) => {
                setLongitude(
                  event.target.value,
                );
              }}
            />
          </label>
          <button
            type="submit"
            disabled={!configured}
          >
            Abrir coordenadas
          </button>
        </form>
        <button type="button" onClick={onReturnToMap}>Ver destaque no mapa ZeroHub</button>
      </header>

      {!configured && (
        <div className="googleEmbedState">
          <strong>
            Google Maps Embed não configurado
          </strong>
          <p>
            Cadastre uma chave restrita à Maps Embed API. A conta Google pode exigir faturamento ativo.
          </p>
          <button
            type="button"
            onClick={onConfigure}
          >
            Abrir configurações
          </button>
        </div>
      )}

      {configured && error && (
        <div
          className="googleEmbedState error"
          role="alert"
        >
          <strong>
            Não foi possível carregar a vista
          </strong>
          <p>{error}</p>
          <button
            type="button"
            onClick={reload}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {configured && sessionUrl && (
        <iframe
          key={`${revision}:${mode}`}
          className="googleEmbedFrame"
          title={
            mode === 'map-2d'
              ? 'Google Maps 2D'
              : 'Google Street View 360 graus'
          }
          src={sessionUrl}
          allow="fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => {
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            setError(
              'O frame do Google foi bloqueado ou a conexão falhou.',
            );
          }}
        />
      )}

      {configured && loading && (
        <div
          className="googleEmbedLoading"
          role="status"
        >
          Carregando conteúdo do Google…
        </div>
      )}

      {configured && sessionUrl && (
        <footer className="googleEmbedNotice">
          © Google · disponibilidade do Street View depende da cobertura. Verifique restrições da chave, cotas e faturamento se o provedor exibir erro.
        </footer>
      )}
    </section>
  );
}
