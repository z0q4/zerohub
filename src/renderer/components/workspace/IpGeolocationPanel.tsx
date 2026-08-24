import {
  memo,
  useEffect,
} from 'react';

import {
  formatIpGeolocationSummary,
} from './ip-geolocation-activities';
import {
  MAP_MARKER_COLORS,
  getMapMarkerColorValue,
} from './map-workspace.types';

import type {
  FormEvent,
} from 'react';
import type {
  IpGeolocationFeedback,
  IpGeolocationHistoryItem,
  IpGeolocationResult,
  IpGeolocationVersionFilter,
  IpPublicFamilyStatus,
} from './ip-geolocation.types';
import type {
  MapMarkerColor,
} from './map-workspace.types';

type IpGeolocationPanelProps = {
  activeCaseName: string | null;
  allResults: IpGeolocationResult[];
  busy: boolean;
  caseBusy: boolean;
  connectResults: boolean;
  copiedTarget: string | null;
  feedback:
    IpGeolocationFeedback | null;
  history: IpGeolocationHistoryItem[];
  input: string;
  open: boolean;
  publicFamilyStatuses:
    IpPublicFamilyStatus[];
  results: IpGeolocationResult[];
  savingResultId: string | null;
  selectedResult:
    IpGeolocationResult | null;
  versionFilter:
    IpGeolocationVersionFilter;

  onCancel(): void;
  onClear(): void;
  onClose(): void;
  onColorChange(
    resultId: string,
    color: MapMarkerColor,
  ): void;
  onConnectResultsChange(
    enabled: boolean,
  ): void;
  onCopyIp(result: IpGeolocationResult): void;
  onCopyCoordinates(
    result: IpGeolocationResult,
  ): void;
  onCopySummary(
    result: IpGeolocationResult,
  ): void;
  onFocus(result: IpGeolocationResult): void;
  onHistorySelect(resultId: string): void;
  onInputChange(value: string): void;
  onLookup(): void;
  onLookupPublicIp(): void;
  onOpenRdap(result: IpGeolocationResult): void;
  onRemoveHistory(historyId: string): void;
  onRemoveResult(resultId: string): void;
  onResultSelect(resultId: string): void;
  onSave(resultId: string): void;
  onVersionFilterChange(
    filter: IpGeolocationVersionFilter,
  ): void;
};

const DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'medium',
    },
  );

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : DATE_FORMATTER.format(date);
}

function displayValue(
  value: string | null,
): string {
  return value ?? 'Não informado';
}

export const IpGeolocationPanel = memo(
  function IpGeolocationPanel({
    activeCaseName,
    allResults,
    busy,
    caseBusy,
    connectResults,
    copiedTarget,
    feedback,
    history,
    input,
    onCancel,
    onClear,
    onClose,
    onColorChange,
    onConnectResultsChange,
    onCopyCoordinates,
    onCopyIp,
    onCopySummary,
    onFocus,
    onHistorySelect,
    onInputChange,
    onLookup,
    onLookupPublicIp,
    onOpenRdap,
    onRemoveHistory,
    onRemoveResult,
    onResultSelect,
    onSave,
    open,
    publicFamilyStatuses,
    results,
    savingResultId,
    selectedResult,
    versionFilter,
    onVersionFilterChange,
  }: IpGeolocationPanelProps) {
    useEffect(() => {
      if (!open) {
        return undefined;
      }

      const handleEscape = (
        event: KeyboardEvent,
      ): void => {
        if (event.key !== 'Escape') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onClose();
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
    }, [onClose, open]);

    if (!open) {
      return null;
    }

    const handleSubmit = (
      event: FormEvent,
    ): void => {
      event.preventDefault();
      onLookup();
    };

    return (
      <section
        className="ipGeolocationPanel"
        id="ip-geolocation-panel"
        aria-labelledby="ip-geolocation-title"
        aria-busy={busy}
      >
        <header>
          <div>
            <span>GEO INTELLIGENCE</span>
            <strong id="ip-geolocation-title">
              IP Intelligence
            </strong>
          </div>

          <button
            type="button"
            aria-label="Minimizar IP Intelligence"
            onClick={onClose}
          >
            —
          </button>
        </header>

        <form
          className="ipGeolocationSearch"
          onSubmit={handleSubmit}
        >
          <label>
            <span>IPv4 ou IPv6 público</span>
            <input
              value={input}
              type="text"
              inputMode="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              placeholder="8.8.8.8 ou 2606:4700:4700::1111"
              aria-invalid={
                feedback?.tone === 'error'
              }
              onChange={(event) => {
                onInputChange(
                  event.target.value,
                );
              }}
            />
          </label>

          <div>
            <button
              className="isPrimary"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Consultando...'
                : 'Buscar'}
            </button>

            <button
              type="button"
              disabled={!busy}
              onClick={onCancel}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onClear}
            >
              Limpar
            </button>

            <button
              type="button"
              disabled={busy}
              title="Consulta o IP público somente após este clique"
              onClick={onLookupPublicIp}
            >
              Meu IP público
            </button>
          </div>
        </form>

        {feedback && (
          <p
            className={`ipGeolocationFeedback ${feedback.tone}`}
            role={
              feedback.tone === 'error'
                ? 'alert'
                : 'status'
            }
            aria-live="polite"
          >
            {feedback.message}
          </p>
        )}

        <div
          className="ipGeolocationVersionFilters"
          role="group"
          aria-label="Filtrar famílias de IP"
        >
          {([
            ['all', 'Todos'],
            ['IPv4', 'IPv4'],
            ['IPv6', 'IPv6'],
          ] as const).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={
                  versionFilter === value
                }
                onClick={() => {
                  onVersionFilterChange(
                    value,
                  );
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {publicFamilyStatuses.length >
          0 && (
          <div className="ipPublicFamilyStatuses">
            {publicFamilyStatuses.map(
              (status) => (
                <span
                  key={status.version}
                  className={
                    status.available
                      ? 'isAvailable'
                      : 'isUnavailable'
                  }
                  title={status.message}
                >
                  {status.available
                    ? `${status.version} disponível`
                    : `${status.version} indisponível`}
                </span>
              ),
            )}
          </div>
        )}

        <label className="ipGeolocationConnect">
          <input
            type="checkbox"
            checked={connectResults}
            disabled={results.length < 2}
            onChange={(event) => {
              onConnectResultsChange(
                event.target.checked,
              );
            }}
          />
          <span>
            Conectar resultados
            <small>
              Comparação visual; não representa rota real de rede.
            </small>
          </span>
        </label>

        {results.length > 0 && (
          <div className="ipGeolocationResultTabs">
            {results.map((result) => (
              <button
                type="button"
                key={result.id}
                aria-pressed={
                  selectedResult?.id ===
                  result.id
                }
                style={{
                  '--result-color':
                    getMapMarkerColorValue(
                      result.color,
                    ),
                } as React.CSSProperties}
                onClick={() => {
                  onResultSelect(result.id);
                }}
              >
                <span
                  className="ipResultTabMarker"
                  aria-hidden="true"
                />
                {result.ip}
              </button>
            ))}
          </div>
        )}

        {selectedResult ? (
          <article className="ipGeolocationResultCard">
            <header>
              <div>
                <span>
                  LOCALIZAÇÃO APROXIMADA
                </span>
                <strong>
                  {selectedResult.ip}
                </strong>
                <small>
                  {selectedResult.version}
                  {' · '}
                  {selectedResult.saved
                    ? 'Salvo no perfil'
                    : 'Resultado transitório'}
                </small>
              </div>

              <span
                className="ipApproximationBadge"
              >
                Estimativa
              </span>
            </header>

            <dl>
              <div>
                <dt>Cidade</dt>
                <dd>
                  {displayValue(
                    selectedResult.city,
                  )}
                </dd>
              </div>
              <div>
                <dt>Região</dt>
                <dd>
                  {displayValue(
                    selectedResult.region,
                  )}
                </dd>
              </div>
              <div>
                <dt>País</dt>
                <dd>
                  {displayValue(
                    selectedResult.country,
                  )}
                  {selectedResult.countryCode
                    ? ` (${selectedResult.countryCode})`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>Código postal</dt>
                <dd>
                  {displayValue(
                    selectedResult.postalCode,
                  )}
                </dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>
                  {displayValue(
                    selectedResult.timezone,
                  )}
                </dd>
              </div>
              <div>
                <dt>Moeda</dt>
                <dd>
                  {displayValue(
                    selectedResult.currency,
                  )}
                </dd>
              </div>
              <div className="isWide">
                <dt>Coordenadas aproximadas</dt>
                <dd>
                  {selectedResult.latitude.toFixed(5)}
                  {', '}
                  {selectedResult.longitude.toFixed(5)}
                </dd>
              </div>
              <div>
                <dt>ASN</dt>
                <dd>
                  {displayValue(
                    selectedResult.asn,
                  )}
                </dd>
              </div>
              <div className="isWide">
                <dt>Organização / provedor</dt>
                <dd>
                  {displayValue(
                    selectedResult.organization,
                  )}
                </dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>
                  {selectedResult.provider}
                </dd>
              </div>
              <div className="isWide">
                <dt>Consultado em</dt>
                <dd>
                  {formatDate(
                    selectedResult.consultedAt,
                  )}
                </dd>
              </div>
            </dl>

            <fieldset
              className="ipGeolocationColors"
              disabled={selectedResult.saved}
            >
              <legend>Cor do resultado</legend>
              <div>
                {MAP_MARKER_COLORS.map(
                  (color) => (
                    <button
                      type="button"
                      key={color.id}
                      aria-label={color.label}
                      aria-pressed={
                        selectedResult.color ===
                        color.id
                      }
                      title={color.label}
                      style={{
                        '--result-color':
                          color.value,
                      } as React.CSSProperties}
                      onClick={() => {
                        onColorChange(
                          selectedResult.id,
                          color.id,
                        );
                      }}
                    />
                  ),
                )}
              </div>
              {selectedResult.saved && (
                <small>
                  A cor salva é reconstruída pela timeline.
                </small>
              )}
            </fieldset>

            <div className="ipGeolocationActions">
              <button
                type="button"
                onClick={() => {
                  onFocus(selectedResult);
                }}
              >
                Focar no globo
              </button>
              <button
                type="button"
                onClick={() => {
                  onCopyIp(selectedResult);
                }}
              >
                {copiedTarget ===
                  `ip:${selectedResult.id}`
                  ? 'IP copiado'
                  : 'Copiar IP'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCopyCoordinates(
                    selectedResult,
                  );
                }}
              >
                {copiedTarget ===
                  `ip-coordinates:${selectedResult.id}`
                  ? 'Coordenadas copiadas'
                  : 'Copiar coordenadas'}
              </button>
              <button
                type="button"
                title={
                  formatIpGeolocationSummary(
                    selectedResult,
                  )
                }
                onClick={() => {
                  onCopySummary(
                    selectedResult,
                  );
                }}
              >
                {copiedTarget ===
                  `ip-summary:${selectedResult.id}`
                  ? 'Resumo copiado'
                  : 'Copiar resumo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenRdap(selectedResult);
                }}
              >
                Abrir módulo RDAP
              </button>
              <button
                className="isPrimary"
                type="button"
                disabled={
                  selectedResult.saved ||
                  !activeCaseName ||
                  caseBusy ||
                  savingResultId ===
                    selectedResult.id
                }
                onClick={() => {
                  onSave(selectedResult.id);
                }}
              >
                {selectedResult.saved
                  ? 'Salvo no perfil'
                  : savingResultId ===
                      selectedResult.id
                    ? 'Salvando...'
                    : activeCaseName
                      ? `Salvar em ${activeCaseName}`
                      : 'Selecione um perfil'}
              </button>
              {!selectedResult.saved && (
                <button
                  className="isDanger"
                  type="button"
                  onClick={() => {
                    onRemoveResult(
                      selectedResult.id,
                    );
                  }}
                >
                  Remover transitório
                </button>
              )}
            </div>
          </article>
        ) : (
          <div className="ipGeolocationEmpty">
            <strong>
              Nenhum resultado selecionado
            </strong>
            <p>
              A geolocalização por IP é uma
              estimativa e não identifica uma
              posição física exata.
            </p>
          </div>
        )}

        <details className="ipGeolocationHistory">
          <summary>
            Histórico da sessão
            <span>{history.length} / 20</span>
          </summary>

          {history.length > 0 ? (
            <div>
              {history.map((item) => {
                const available =
                  allResults.some(
                    (result) =>
                      result.id ===
                      item.resultId,
                  );

                return (
                  <article key={item.id}>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        onHistorySelect(
                          item.resultId,
                        );
                      }}
                    >
                      <strong>{item.ip}</strong>
                      <small>
                        {formatDate(
                          item.consultedAt,
                        )}
                      </small>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        `Remover ${item.ip} do histórico`
                      }
                      onClick={() => {
                        onRemoveHistory(item.id);
                      }}
                    >
                      ×
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p>
              Nenhuma consulta nesta sessão.
            </p>
          )}
        </details>
      </section>
    );
  },
);
