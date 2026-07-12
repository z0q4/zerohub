import {
  useMemo,
  useState,
} from 'react';

import type {
  EmailSecurityFinding,
  EmailSecurityResult,
} from '../../../../shared/email-security/email-security.types';

type EmailTab =
  | 'summary'
  | 'spf'
  | 'dmarc'
  | 'dkim'
  | 'mx'
  | 'raw';

function findingCount(
  findings: EmailSecurityFinding[],
  severity: EmailSecurityFinding[
    'severity'
  ],
): number {
  return findings.filter(
    (finding) =>
      finding.severity === severity,
  ).length;
}

function RecordCard({
  title,
  record,
}: {
  title: string;
  record: string | null;
}) {
  return (
    <article className="emailSecurityCard">
      <header>
        <span>{title}</span>
      </header>

      <pre>
        {record ??
          'Registro não encontrado.'}
      </pre>
    </article>
  );
}

export function EmailSecurityTool() {
  const [
    domain,
    setDomain,
  ] = useState(
    'example.com',
  );

  const [
    selector,
    setSelector,
  ] = useState('');

  const [
    result,
    setResult,
  ] =
    useState<EmailSecurityResult | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<EmailTab>(
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

  const severityCounts =
    useMemo(
      () => {
        if (!result) {
          return {
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
          };
        }

        return {
          high:
            findingCount(
              result.findings,
              'high',
            ),

          medium:
            findingCount(
              result.findings,
              'medium',
            ),

          low:
            findingCount(
              result.findings,
              'low',
            ),

          info:
            findingCount(
              result.findings,
              'info',
            ),
        };
      },
      [result],
    );

  async function inspect():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const analysis =
        await window.zeroHub
          .emailSecurity
          .inspect(
            domain,
            selector,
          );

      setResult(analysis);
      setActiveTab('summary');
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível analisar o domínio.',
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
            EMAIL SECURITY · PYTHON
          </span>

          <h2>Email Authentication Inspector</h2>

          <p>
            Analise MX, SPF, DMARC e uma
            chave DKIM usando o resolvedor
            DNS configurado no sistema.
          </p>
        </div>

        <span className="nativeToolBadge">
          DNS Analysis
        </span>
      </div>

      <div className="emailSecurityToolbar">
        <label>
          <span>Domínio</span>

          <input
            value={domain}
            type="text"
            spellCheck={false}
            placeholder="exemplo.com"
            disabled={busy}
            onChange={(event) => {
              setDomain(
                event.target.value,
              );
            }}
          />
        </label>

        <label>
          <span>
            Seletor DKIM
            {' '}
            (opcional)
          </span>

          <input
            value={selector}
            type="text"
            spellCheck={false}
            placeholder="default, google, selector1..."
            disabled={busy}
            onChange={(event) => {
              setSelector(
                event.target.value,
              );
            }}
          />
        </label>

        <button
          className="primaryButton"
          type="button"
          disabled={
            busy ||
            !domain.trim()
          }
          onClick={() => {
            void inspect();
          }}
        >
          {busy
            ? 'Consultando DNS...'
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
        <div className="emailSecurityEmpty">
          <span>MAIL</span>

          <h3>
            Nenhum domínio analisado
          </h3>

          <p>
            Informe um domínio e,
            opcionalmente, um seletor DKIM.
          </p>
        </div>
      )}

      {result && (
        <div className="emailSecurityResults">
          <div className="emailSecurityHero">
            <div>
              <span>DOMÍNIO</span>

              <h3>
                {result.domain}
              </h3>

              <code>
                DNS:
                {' '}
                {result.nameservers.join(
                  ', ',
                )}
              </code>
            </div>

            <div>
              <strong>
                {result.grade}
              </strong>

              <small>
                {result.score}/100
              </small>
            </div>
          </div>

          <div className="emailSecurityStats">
            <article>
              <span>MX</span>
              <strong>
                {result.mx.length}
              </strong>
            </article>

            <article>
              <span>SPF</span>
              <strong>
                {result.spf.present
                  ? result.spf.strength
                  : 'Missing'}
              </strong>
            </article>

            <article>
              <span>DMARC</span>
              <strong>
                {result.dmarc.present
                  ? result.dmarc.policy
                  : 'Missing'}
              </strong>
            </article>

            <article
              className={
                severityCounts.high > 0
                  ? 'danger'
                  : ''
              }
            >
              <span>HIGH FINDINGS</span>
              <strong>
                {severityCounts.high}
              </strong>
            </article>
          </div>

          <div className="emailSecurityTabs">
            {(
              [
                ['summary', 'Resumo'],
                ['spf', 'SPF'],
                ['dmarc', 'DMARC'],
                ['dkim', 'DKIM'],
                ['mx', 'MX'],
                ['raw', 'DNS/Raw'],
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
            <div className="emailSecurityGrid">
              <article className="emailSecurityCard">
                <header>
                  <span>CONFIGURAÇÃO</span>
                </header>

                <dl>
                  <div>
                    <dt>MX</dt>
                    <dd>
                      {result.mx.length > 0
                        ? 'Configurado'
                        : 'Ausente'}
                    </dd>
                  </div>

                  <div>
                    <dt>SPF</dt>
                    <dd>
                      {result.spf.strength}
                    </dd>
                  </div>

                  <div>
                    <dt>DMARC</dt>
                    <dd>
                      {result.dmarc.strength}
                    </dd>
                  </div>

                  <div>
                    <dt>DKIM</dt>
                    <dd>
                      {!result.dkim.checked
                        ? 'Não consultado'
                        : result.dkim.present
                          ? result.dkim.revoked
                            ? 'Revogado'
                            : 'Encontrado'
                          : 'Ausente'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="emailSecurityCard">
                <header>
                  <span>FINDINGS</span>

                  <strong>
                    {result.findings.length}
                  </strong>
                </header>

                <div className="emailFindingList">
                  {result.findings.map(
                    (
                      finding,
                      index,
                    ) => (
                      <article
                        className={
                          finding.severity
                        }
                        key={`${finding.title}-${index}`}
                      >
                        <div>
                          <strong>
                            {finding.title}
                          </strong>

                          <span>
                            {
                              finding.severity
                            }
                          </span>
                        </div>

                        <p>
                          {finding.detail}
                        </p>
                      </article>
                    ),
                  )}
                </div>
              </article>

              <RecordCard
                title="SPF RECORD"
                record={result.spf.record}
              />

              <RecordCard
                title="DMARC RECORD"
                record={result.dmarc.record}
              />
            </div>
          )}

          {activeTab === 'spf' && (
            <div className="emailSecurityGrid">
              <RecordCard
                title="SPF RECORD"
                record={result.spf.record}
              />

              <article className="emailSecurityCard">
                <header>
                  <span>RESUMO SPF</span>
                </header>

                <dl>
                  <div>
                    <dt>Presente</dt>
                    <dd>
                      {result.spf.present
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>

                  <div>
                    <dt>Força</dt>
                    <dd>
                      {result.spf.strength}
                    </dd>
                  </div>

                  <div>
                    <dt>all</dt>
                    <dd>
                      {result.spf
                        .allQualifier ??
                        'Ausente'}
                    </dd>
                  </div>

                  <div>
                    <dt>Consultas estimadas</dt>
                    <dd>
                      {
                        result.spf
                          .lookupEstimate
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Múltiplos registros</dt>
                    <dd>
                      {result.spf.multiple
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="emailSecurityCard full">
                <header>
                  <span>MECANISMOS</span>

                  <strong>
                    {
                      result.spf
                        .mechanisms.length
                    }
                  </strong>
                </header>

                <div className="emailMechanismList">
                  {result.spf.mechanisms.map(
                    (
                      mechanism,
                      index,
                    ) => (
                      <button
                        key={`${mechanism.raw}-${index}`}
                        type="button"
                        onClick={() => {
                          copy(
                            mechanism.raw,
                          );
                        }}
                      >
                        <code>
                          {
                            mechanism.qualifier
                          }
                          {
                            mechanism.name
                          }
                        </code>

                        <span>
                          {mechanism.value ??
                            '—'}
                        </span>

                        <small>
                          {mechanism.kind}
                        </small>
                      </button>
                    ),
                  )}
                </div>
              </article>
            </div>
          )}

          {activeTab === 'dmarc' && (
            <div className="emailSecurityGrid">
              <RecordCard
                title="DMARC RECORD"
                record={
                  result.dmarc.record
                }
              />

              <article className="emailSecurityCard">
                <header>
                  <span>RESUMO DMARC</span>
                </header>

                <dl>
                  <div>
                    <dt>Política</dt>
                    <dd>
                      {result.dmarc.policy ??
                        'Ausente'}
                    </dd>
                  </div>

                  <div>
                    <dt>Subdomínios</dt>
                    <dd>
                      {result.dmarc
                        .subdomainPolicy ??
                        'Herdado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Aplicação</dt>
                    <dd>
                      {result.dmarc
                        .percentage ??
                        'Inválido'}
                      %
                    </dd>
                  </div>

                  <div>
                    <dt>Força</dt>
                    <dd>
                      {
                        result.dmarc
                          .strength
                      }
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="emailSecurityCard full">
                <header>
                  <span>TAGS DMARC</span>
                </header>

                <div className="emailTagList">
                  {Object.entries(
                    result.dmarc.tags,
                  ).map(
                    ([
                      name,
                      value,
                    ]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          copy(
                            `${name}=${value}`,
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
            </div>
          )}

          {activeTab === 'dkim' && (
            <div className="emailSecurityGrid">
              <RecordCard
                title="DKIM RECORD"
                record={result.dkim.record}
              />

              <article className="emailSecurityCard">
                <header>
                  <span>RESUMO DKIM</span>
                </header>

                <dl>
                  <div>
                    <dt>Consultado</dt>
                    <dd>
                      {result.dkim.checked
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>

                  <div>
                    <dt>Seletor</dt>
                    <dd>
                      {result.dkim.selector ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Tipo de chave</dt>
                    <dd>
                      {result.dkim.keyType ??
                        'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Chave pública</dt>
                    <dd>
                      {result.dkim
                        .publicKeyPresent
                        ? 'Presente'
                        : 'Ausente'}
                    </dd>
                  </div>

                  <div>
                    <dt>Bytes decodificados</dt>
                    <dd>
                      {result.dkim
                        .decodedPublicKeyBytes ??
                        '—'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="emailSecurityCard full">
                <header>
                  <span>TAGS DKIM</span>
                </header>

                <div className="emailTagList">
                  {Object.entries(
                    result.dkim.tags,
                  ).map(
                    ([
                      name,
                      value,
                    ]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          copy(
                            `${name}=${value}`,
                          );
                        }}
                      >
                        <code>{name}</code>
                        <span>
                          {name === 'p'
                            ? `${value.slice(
                                0,
                                32,
                              )}…`
                            : value}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </article>
            </div>
          )}

          {activeTab === 'mx' && (
            <article className="emailSecurityTablePanel">
              <header>
                <span>MX RECORDS</span>

                <strong>
                  {result.mx.length}
                </strong>
              </header>

              <div>
                <div className="emailSecurityTableHeader">
                  <span>PRIORIDADE</span>
                  <span>HOST</span>
                  <span>TTL</span>
                </div>

                {result.mx.map(
                  (mx) => (
                    <button
                      key={`${mx.preference}-${mx.exchange}`}
                      type="button"
                      onClick={() => {
                        copy(mx.exchange);
                      }}
                    >
                      <strong>
                        {mx.preference}
                      </strong>

                      <code>
                        {mx.exchange}
                      </code>

                      <span>
                        {mx.ttl}s
                      </span>
                    </button>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab === 'raw' && (
            <div className="emailSecurityGrid">
              <article className="emailSecurityCard">
                <header>
                  <span>ROOT TXT</span>
                </header>

                <pre>
                  {JSON.stringify(
                    result.raw.rootTxt,
                    null,
                    2,
                  )}
                </pre>
              </article>

              <article className="emailSecurityCard">
                <header>
                  <span>DMARC TXT</span>
                </header>

                <pre>
                  {JSON.stringify(
                    result.raw.dmarcTxt,
                    null,
                    2,
                  )}
                </pre>
              </article>

              <article className="emailSecurityCard">
                <header>
                  <span>DKIM TXT</span>
                </header>

                <pre>
                  {JSON.stringify(
                    result.raw.dkimTxt,
                    null,
                    2,
                  )}
                </pre>
              </article>

              <article className="emailSecurityCard">
                <header>
                  <span>DNS QUERIES</span>
                </header>

                <pre>
                  {JSON.stringify(
                    result.queries,
                    null,
                    2,
                  )}
                </pre>
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
