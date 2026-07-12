import {
  useMemo,
  useState,
} from 'react';

import type {
  LogAnalysisResult,
  LogCountItem,
} from '../../../../shared/log-analysis/log-analysis.types';

type LogTab =
  | 'summary'
  | 'ips'
  | 'http'
  | 'events';

function formatBytes(
  bytes: number,
): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  return `${(
    bytes /
    1024 ** index
  ).toFixed(
    index === 0 ? 0 : 2,
  )} ${units[index]}`;
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Não identificado';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'medium',
    },
  ).format(date);
}

function formatName(
  value: LogAnalysisResult[
    'detectedFormat'
  ],
): string {
  switch (value) {
    case 'http':
      return 'Apache / Nginx';

    case 'ssh-auth':
      return 'SSH / Auth';

    case 'json-lines':
      return 'JSON Lines';

    case 'generic':
      return 'Genérico';
  }
}

function CountList({
  title,
  items,
}: {
  title: string;
  items: LogCountItem[];
}) {
  const maximum =
    Math.max(
      1,
      ...items.map(
        (item) => item.count,
      ),
    );

  return (
    <article className="logCard">
      <header>
        <span>{title}</span>

        <strong>
          {items.length}
        </strong>
      </header>

      {items.length === 0 ? (
        <p className="logEmptyText">
          Nenhum dado encontrado.
        </p>
      ) : (
        <div className="logCountList">
          {items.map(
            (item) => (
              <button
                key={item.value}
                type="button"
                title="Copiar"
                onClick={() => {
                  window.zeroHub
                    .clipboard
                    .writeText(
                      item.value,
                    );
                }}
              >
                <div>
                  <code>
                    {item.value}
                  </code>

                  <strong>
                    {item.count}
                  </strong>
                </div>

                <span>
                  <i
                    style={{
                      width:
                        `${(
                          item.count /
                          maximum
                        ) * 100}%`,
                    }}
                  />
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </article>
  );
}

export function LogAnalysisTool() {
  const [
    result,
    setResult,
  ] =
    useState<LogAnalysisResult | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<LogTab>(
      'summary',
    );

  const [
    eventFilter,
    setEventFilter,
  ] = useState('');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    busy,
    setBusy,
  ] = useState(false);

  const filteredEvents =
    useMemo(
      () => {
        if (!result) {
          return [];
        }

        const query =
          eventFilter
            .trim()
            .toLowerCase();

        if (!query) {
          return result.eventSamples;
        }

        return result.eventSamples.filter(
          (event) =>
            [
              event.message,
              event.source,
              event.ip ?? '',
              event.path ?? '',
              event.method ?? '',
              String(
                event.statusCode ?? '',
              ),
              event.level,
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(query),
            ),
        );
      },
      [
        eventFilter,
        result,
      ],
    );

  async function inspectFile():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const analysis =
        await window.zeroHub
          .logAnalysis
          .inspectFile();

      if (analysis) {
        setResult(analysis);
        setActiveTab('summary');
        setEventFilter('');
      }
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível analisar o log.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            LOG ANALYSIS · PYTHON
          </span>

          <h2>Log Inspector</h2>

          <p>
            Analise logs HTTP, SSH,
            JSON Lines e arquivos de texto
            genéricos.
          </p>
        </div>

        <span className="nativeToolBadge">
          Local Analysis
        </span>
      </div>

      <div className="logToolbar">
        <div>
          <strong>
            Arquivo local
          </strong>

          <span>
            Limite de 500.000 linhas por
            análise.
          </span>
        </div>

        <button
          className="primaryButton"
          type="button"
          disabled={busy}
          onClick={() => {
            void inspectFile();
          }}
        >
          {busy
            ? 'Analisando...'
            : 'Selecionar log'}
        </button>
      </div>

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="logEmpty">
          <span>LOG</span>

          <h3>
            Nenhum log analisado
          </h3>

          <p>
            Selecione access.log,
            auth.log, JSONL ou outro
            arquivo textual.
          </p>
        </div>
      )}

      {result && (
        <div className="logResults">
          <div className="logHero">
            <div>
              <span>ARQUIVO</span>

              <h3>
                {result.fileName}
              </h3>

              <code>
                {result.filePath}
              </code>
            </div>

            <div>
              <strong>
                {formatName(
                  result.detectedFormat,
                )}
              </strong>

              <small>
                {formatBytes(
                  result.sizeBytes,
                )}
              </small>
            </div>
          </div>

          <div className="logStats">
            <article>
              <span>LINHAS</span>
              <strong>
                {result.totalLines}
              </strong>
            </article>

            <article className="error">
              <span>ERROS</span>
              <strong>
                {result.levels.error}
              </strong>
            </article>

            <article className="warning">
              <span>AVISOS</span>
              <strong>
                {result.levels.warning}
              </strong>
            </article>

            <article>
              <span>IPS ÚNICOS</span>
              <strong>
                {result.topIps.length}
              </strong>
            </article>
          </div>

          {result.truncated && (
            <div className="toolMessage error">
              O limite de 500.000 linhas
              foi atingido. O resultado é
              parcial.
            </div>
          )}

          <div className="logTabs">
            {(
              [
                [
                  'summary',
                  'Resumo',
                ],
                [
                  'ips',
                  'IPs',
                ],
                [
                  'http',
                  'HTTP',
                ],
                [
                  'events',
                  'Eventos',
                ],
              ] as const
            ).map(
              ([
                id,
                label,
              ]) => (
                <button
                  className={
                    activeTab === id
                      ? 'active'
                      : ''
                  }
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {activeTab ===
            'summary' && (
            <div className="logGrid">
              <article className="logCard">
                <header>
                  <span>ANÁLISE</span>
                </header>

                <dl>
                  <div>
                    <dt>Formato</dt>
                    <dd>
                      {formatName(
                        result.detectedFormat,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Interpretadas</dt>
                    <dd>
                      {result.parsedLines}
                    </dd>
                  </div>

                  <div>
                    <dt>Genéricas/vazias</dt>
                    <dd>
                      {result.malformedLines}
                    </dd>
                  </div>

                  <div>
                    <dt>Primeiro evento</dt>
                    <dd>
                      {formatDate(
                        result.firstTimestamp,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Último evento</dt>
                    <dd>
                      {formatDate(
                        result.lastTimestamp,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="logCard">
                <header>
                  <span>NÍVEIS</span>
                </header>

                <dl>
                  {Object.entries(
                    result.levels,
                  ).map(
                    ([
                      level,
                      count,
                    ]) => (
                      <div key={level}>
                        <dt>{level}</dt>
                        <dd>{count}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </article>

              <article className="logCard">
                <header>
                  <span>SSH / AUTENTICAÇÃO</span>
                </header>

                <dl>
                  <div>
                    <dt>Falhas</dt>
                    <dd>
                      {result.auth.failed}
                    </dd>
                  </div>

                  <div>
                    <dt>Sucessos</dt>
                    <dd>
                      {
                        result.auth
                          .successful
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Usuários inválidos</dt>
                    <dd>
                      {
                        result.auth
                          .invalidUsers
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Eventos sudo</dt>
                    <dd>
                      {
                        result.auth
                          .sudoEvents
                      }
                    </dd>
                  </div>
                </dl>
              </article>

              <CountList
                title="FONTES / PROCESSOS"
                items={
                  result.topSources
                }
              />
            </div>
          )}

          {activeTab ===
            'ips' && (
            <div className="logGrid">
              <CountList
                title="IPS MAIS ATIVOS"
                items={
                  result.topIps
                }
              />

              <article className="logCard">
                <header>
                  <span>TIMELINE</span>

                  <strong>
                    {
                      result.timeline
                        .length
                    }
                  </strong>
                </header>

                {result.timeline.length ===
                0 ? (
                  <p className="logEmptyText">
                    Nenhum timestamp foi
                    reconhecido.
                  </p>
                ) : (
                  <div className="logTimeline">
                    {result.timeline.map(
                      (item) => (
                        <div
                          key={
                            item.bucket
                          }
                        >
                          <code>
                            {
                              item.bucket
                            }
                          </code>

                          <span>
                            {item.count}
                            {' eventos · '}
                            {item.errors}
                            {' erros · '}
                            {item.warnings}
                            {' avisos'}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>
            </div>
          )}

          {activeTab ===
            'http' && (
            <div className="logGrid">
              <CountList
                title="STATUS HTTP"
                items={
                  result.statusCodes
                }
              />

              <CountList
                title="MÉTODOS"
                items={
                  result.topMethods
                }
              />

              <CountList
                title="ROTAS MAIS ACESSADAS"
                items={
                  result.topPaths
                }
              />

              <CountList
                title="USER-AGENTS"
                items={
                  result.topUserAgents
                }
              />
            </div>
          )}

          {activeTab ===
            'events' && (
            <article className="logEventsPanel">
              <header>
                <div>
                  <span>
                    EVENTOS AMOSTRADOS
                  </span>

                  <strong>
                    {
                      filteredEvents
                        .length
                    }
                  </strong>
                </div>

                <input
                  value={eventFilter}
                  type="search"
                  placeholder="Filtrar IP, mensagem, rota..."
                  onChange={(event) => {
                    setEventFilter(
                      event.target.value,
                    );
                  }}
                />
              </header>

              <div className="logEventList">
                {filteredEvents.map(
                  (
                    event,
                    index,
                  ) => (
                    <button
                      className={
                        event.level
                      }
                      key={`${event.lineNumber}-${index}`}
                      type="button"
                      title="Copiar mensagem"
                      onClick={() => {
                        window.zeroHub
                          .clipboard
                          .writeText(
                            event.message,
                          );
                      }}
                    >
                      <div>
                        <code>
                          L{
                            event.lineNumber
                          }
                        </code>

                        <span>
                          {event.level}
                        </span>

                        <small>
                          {event.source}
                        </small>
                      </div>

                      <p>
                        {event.message}
                      </p>

                      <footer>
                        {event.timestamp && (
                          <span>
                            {formatDate(
                              event.timestamp,
                            )}
                          </span>
                        )}

                        {event.ip && (
                          <code>
                            {event.ip}
                          </code>
                        )}

                        {event.statusCode !==
                          null && (
                          <strong>
                            {
                              event.statusCode
                            }
                          </strong>
                        )}
                      </footer>
                    </button>
                  ),
                )}
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
