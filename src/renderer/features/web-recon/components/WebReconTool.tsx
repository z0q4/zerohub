import {
  useMemo,
  useState,
} from 'react';

import type {
  WebReconResult,
} from '../../../../shared/web-recon/web-recon.types';

type WebReconTab =
  | 'summary'
  | 'redirects'
  | 'security'
  | 'tls'
  | 'standard-files'
  | 'headers';

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Não informado';
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
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

export function WebReconTool() {
  const [
    url,
    setUrl,
  ] = useState(
    'https://example.com',
  );

  const [
    result,
    setResult,
  ] =
    useState<WebReconResult | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<WebReconTab>(
      'summary',
    );

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const sortedHeaders =
    useMemo(
      () =>
        result
          ? Object.entries(
              result.headers,
            ).sort(
              ([left], [right]) =>
                left.localeCompare(
                  right,
                ),
            )
          : [],
      [result],
    );

  async function inspect():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const analysis =
        await window.zeroHub
          .webRecon
          .inspect(url);

      setResult(analysis);
      setActiveTab('summary');
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível analisar o endereço.',
      );
    } finally {
      setBusy(false);
    }
  }

  function copy(
    value: string,
  ): void {
    window.zeroHub
      .clipboard
      .writeText(value);
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            WEB RECON · PYTHON
          </span>

          <h2>HTTP & TLS Inspector</h2>

          <p>
            Inspecione respostas HTTP,
            redirecionamentos, cabeçalhos de
            segurança, TLS, robots.txt e
            sitemap.xml.
          </p>
        </div>

        <span className="nativeToolBadge">
          Passive Request
        </span>
      </div>

      <div className="webReconToolbar">
        <input
          value={url}
          type="url"
          spellCheck={false}
          placeholder="https://exemplo.com"
          disabled={busy}
          onChange={(event) => {
            setUrl(
              event.target.value,
            );
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter'
            ) {
              void inspect();
            }
          }}
        />

        <button
          className="primaryButton"
          type="button"
          disabled={
            busy ||
            !url.trim()
          }
          onClick={() => {
            void inspect();
          }}
        >
          {busy
            ? 'Inspecionando...'
            : 'Analisar'}
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
        <div className="webReconEmpty">
          <span>WEB</span>

          <h3>
            Nenhum endereço analisado
          </h3>

          <p>
            Informe uma URL HTTP ou HTTPS
            para iniciar a inspeção.
          </p>
        </div>
      )}

      {result && (
        <div className="webReconResults">
          <div className="webReconHero">
            <div>
              <span>ALVO FINAL</span>

              <h3>
                {result.title ??
                  result.hostname ??
                  result.finalUrl}
              </h3>

              <button
                type="button"
                onClick={() => {
                  copy(
                    result.finalUrl,
                  );
                }}
              >
                <code>
                  {result.finalUrl}
                </code>
              </button>
            </div>

            <div>
              <strong>
                {result.statusCode}
              </strong>

              <small>
                {result.reason}
                {' · '}
                {result.elapsedMs} ms
              </small>
            </div>
          </div>

          <div className="webReconStats">
            <article>
              <span>STATUS</span>
              <strong>
                {result.statusCode}
              </strong>
            </article>

            <article>
              <span>REDIRECTS</span>
              <strong>
                {Math.max(
                  0,
                  result.redirectChain
                    .length - 1,
                )}
              </strong>
            </article>

            <article>
              <span>SECURITY SCORE</span>
              <strong>
                {
                  result.securityHeaders
                    .score
                }
                %
              </strong>
            </article>

            <article>
              <span>TLS</span>
              <strong>
                {result.tls.available
                  ? result.tls.verified
                    ? 'Valid'
                    : 'Invalid'
                  : 'HTTP'}
              </strong>
            </article>
          </div>

          <div className="webReconTabs">
            {(
              [
                ['summary', 'Resumo'],
                ['redirects', 'Redirects'],
                ['security', 'Segurança'],
                ['tls', 'TLS'],
                [
                  'standard-files',
                  'Robots/Sitemap',
                ],
                ['headers', 'Headers'],
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
            <div className="webReconGrid">
              <article className="webReconCard">
                <header>
                  <span>HTTP</span>
                </header>

                <dl>
                  <div>
                    <dt>Host</dt>
                    <dd>
                      {result.hostname}
                    </dd>
                  </div>

                  <div>
                    <dt>Esquema</dt>
                    <dd>
                      {result.scheme}
                    </dd>
                  </div>

                  <div>
                    <dt>Porta</dt>
                    <dd>
                      {result.port}
                    </dd>
                  </div>

                  <div>
                    <dt>Servidor</dt>
                    <dd>
                      {result.server ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Content-Type</dt>
                    <dd>
                      {result.contentType ??
                        'Não informado'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="webReconCard">
                <header>
                  <span>DNS</span>
                </header>

                <div className="webReconValueList">
                  {result.resolvedAddresses.map(
                    (address) => (
                      <button
                        key={address}
                        type="button"
                        onClick={() => {
                          copy(address);
                        }}
                      >
                        <code>
                          {address}
                        </code>
                      </button>
                    ),
                  )}
                </div>
              </article>

              <article className="webReconCard">
                <header>
                  <span>PÁGINA</span>
                </header>

                <dl>
                  <div>
                    <dt>Título</dt>
                    <dd>
                      {result.title ??
                        'Não encontrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Content-Length</dt>
                    <dd>
                      {result.contentLength ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Corpo truncado</dt>
                    <dd>
                      {result.bodyTruncated
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="webReconCard">
                <header>
                  <span>BODY PREVIEW</span>
                </header>

                <pre>
                  {result.bodyPreview ||
                    'Sem conteúdo textual.'}
                </pre>
              </article>
            </div>
          )}

          {activeTab ===
            'redirects' && (
            <article className="webReconListPanel">
              <header>
                <span>
                  CADEIA DE REDIRECIONAMENTO
                </span>

                <strong>
                  {
                    result.redirectChain
                      .length
                  }
                </strong>
              </header>

              <div>
                {result.redirectChain.map(
                  (item) => (
                    <article
                      key={`${item.index}-${item.url}`}
                    >
                      <strong>
                        {item.statusCode}
                      </strong>

                      <div>
                        <code>
                          {item.url}
                        </code>

                        {item.location && (
                          <span>
                            → {item.location}
                          </span>
                        )}
                      </div>

                      <small>
                        {item.elapsedMs} ms
                      </small>
                    </article>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'security' && (
            <article className="webReconListPanel">
              <header>
                <span>
                  CABEÇALHOS DE SEGURANÇA
                </span>

                <strong>
                  {
                    result.securityHeaders
                      .present
                  }
                  /
                  {
                    result.securityHeaders
                      .total
                  }
                </strong>
              </header>

              <div>
                {result.securityHeaders
                  .checks
                  .map(
                    (check) => (
                      <article
                        className={
                          check.status
                        }
                        key={check.name}
                      >
                        <strong>
                          {check.name}
                        </strong>

                        <div>
                          <code>
                            {check.value ??
                              check.status}
                          </code>

                          <span>
                            {
                              check.recommendation
                            }
                          </span>
                        </div>

                        <small>
                          {check.severity}
                        </small>
                      </article>
                    ),
                  )}
              </div>
            </article>
          )}

          {activeTab === 'tls' && (
            <div className="webReconGrid">
              <article className="webReconCard">
                <header>
                  <span>CONEXÃO TLS</span>
                </header>

                <dl>
                  <div>
                    <dt>Disponível</dt>
                    <dd>
                      {result.tls.available
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>

                  <div>
                    <dt>Verificado</dt>
                    <dd>
                      {result.tls.verified ===
                      null
                        ? 'N/A'
                        : result.tls.verified
                          ? 'Sim'
                          : 'Não'}
                    </dd>
                  </div>

                  <div>
                    <dt>Versão</dt>
                    <dd>
                      {result.tls.tlsVersion ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Cifra</dt>
                    <dd>
                      {result.tls.cipher ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Handshake</dt>
                    <dd>
                      {result.tls.handshakeMs ??
                        '—'}
                      {' ms'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="webReconCard">
                <header>
                  <span>CERTIFICADO</span>
                </header>

                <dl>
                  <div>
                    <dt>Subject</dt>
                    <dd>
                      {result.tls.subject ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Issuer</dt>
                    <dd>
                      {result.tls.issuer ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Válido desde</dt>
                    <dd>
                      {formatDate(
                        result.tls.notBefore,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Expira em</dt>
                    <dd>
                      {formatDate(
                        result.tls.notAfter,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Dias restantes</dt>
                    <dd>
                      {result.tls.daysRemaining ??
                        'Não informado'}
                    </dd>
                  </div>
                </dl>

                {result.tls.error && (
                  <p className="webReconWarning">
                    {result.tls.error}
                  </p>
                )}
              </article>

              <article className="webReconCard full">
                <header>
                  <span>SUBJECT ALT NAMES</span>
                </header>

                <div className="webReconValueList">
                  {result.tls.subjectAltNames
                    .map(
                      (name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            copy(name);
                          }}
                        >
                          <code>
                            {name}
                          </code>
                        </button>
                      ),
                    )}
                </div>
              </article>
            </div>
          )}

          {activeTab ===
            'standard-files' && (
            <div className="webReconGrid">
              <article className="webReconCard">
                <header>
                  <span>ROBOTS.TXT</span>

                  <strong>
                    {result.robots
                      .statusCode ??
                      '—'}
                  </strong>
                </header>

                <code>
                  {result.robots.url}
                </code>

                <pre>
                  {result.robots.content ??
                    result.robots.error ??
                    'Não encontrado.'}
                </pre>
              </article>

              <article className="webReconCard">
                <header>
                  <span>SITEMAP.XML</span>

                  <strong>
                    {result.sitemap
                      .statusCode ??
                      '—'}
                  </strong>
                </header>

                <code>
                  {result.sitemap.url}
                </code>

                <pre>
                  {result.sitemap.content ??
                    result.sitemap.error ??
                    'Não encontrado.'}
                </pre>
              </article>

              <article className="webReconCard full">
                <header>
                  <span>
                    SITEMAPS DESCOBERTOS
                  </span>
                </header>

                <div className="webReconValueList">
                  {result.discoveredSitemaps
                    .map(
                      (sitemap) => (
                        <button
                          key={sitemap}
                          type="button"
                          onClick={() => {
                            copy(sitemap);
                          }}
                        >
                          <code>
                            {sitemap}
                          </code>
                        </button>
                      ),
                    )}
                </div>
              </article>
            </div>
          )}

          {activeTab ===
            'headers' && (
            <article className="webReconHeaders">
              <header>
                <span>
                  RESPONSE HEADERS
                </span>

                <strong>
                  {sortedHeaders.length}
                </strong>
              </header>

              <div>
                {sortedHeaders.map(
                  ([
                    name,
                    value,
                  ]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        copy(
                          `${name}: ${value}`,
                        );
                      }}
                    >
                      <code>{name}</code>
                      <span>{value}</span>
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
