import {
  MAP_PROVIDER_DEFINITIONS,
} from '../../../shared/map-providers/map-providers.types';

import type {
  MapProviderKeyStatus,
  MapProviderViewId,
} from '../../../shared/map-providers/map-providers.types';

type MapProviderSelectorProps = {
  activeView: MapProviderViewId;
  googleStatus:
    MapProviderKeyStatus | null;
  statusBusy: boolean;

  onConfigure(): void;
  onSelect(
    view: MapProviderViewId,
  ): void;
};

export function MapProviderSelector({
  activeView,
  googleStatus,
  statusBusy,
  onConfigure,
  onSelect,
}: MapProviderSelectorProps) {
  return (
    <section
      className="mapProviderSelector"
      aria-label="Fontes do mapa"
    >
      <div className="mapProviderSelectorOptions">
        {MAP_PROVIDER_DEFINITIONS.map(
          (provider) => {
            const google =
              provider.provider ===
              'google';
            const unavailable =
              google &&
              !statusBusy &&
              !googleStatus
                ?.configured;

            return (
              <button
                className={
                  activeView ===
                  provider.id
                    ? 'active'
                    : ''
                }
                key={provider.id}
                type="button"
                aria-pressed={
                  activeView ===
                  provider.id
                }
                title={
                  unavailable
                    ? 'Configure a chave do Google Maps Embed em Settings.'
                    : provider.capabilities
                        .supportsMarkers
                      ? 'Suporta marcadores e camadas do ZeroHub.'
                      : 'Vista externa isolada; overlays do ZeroHub ficam preservados no mapa principal.'
                }
                onClick={() => {
                  onSelect(provider.id);
                }}
              >
                <span>{provider.label}</span>
                <small>
                  {provider.provider ===
                  'openfreemap'
                    ? 'LOCAL + ONLINE'
                    : unavailable
                      ? 'CONFIGURAR'
                      : 'GOOGLE EMBED'}
                </small>
              </button>
            );
          },
        )}
      </div>

      {!statusBusy &&
        googleStatus &&
        !googleStatus.configured && (
          <button
            className="mapProviderConfigureButton"
            type="button"
            onClick={onConfigure}
          >
            Configurar Google
          </button>
        )}
    </section>
  );
}
