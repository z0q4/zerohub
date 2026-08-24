import {
  type KeyboardEvent,
  useEffect,
  useState,
} from 'react';

import type {
  RdapDomainResult,
} from '../../../../shared/osint/rdap.types';

import {
  useCaseResultRegistration,
} from '../../cases/useCaseResultRegistration';

function formatDate(
  value: string,
): string {
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

type RdapDomainToolProps = {
  contextDomain?: string | null;
  contextIp?: string | null;
};

export function RdapDomainTool({
  contextDomain = null,
  contextIp = null,
}: RdapDomainToolProps) {
  const {
    activeCase,
    isRegisteredForActiveCase,
    lastRegisteredCase,
    registerResult:
      registerCaseResult,
    registering,
    registrationDisabled,
    registrationError,
    resetResultRegistration,
  } = useCaseResultRegistration({
    errorMessage:
      'Não foi possível registrar a consulta no perfil.',
    missingCaseMessage:
      'Selecione um perfil ativo antes de registrar a consulta.',
  });

  const [
    domain,
    setDomain,
  ] = useState('');

  const [
    result,
    setResult,
  ] =
    useState<RdapDomainResult | null>(
      null,
    );

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

  const [
    copied,
    setCopied,
  ] = useState(false);

  useEffect(() => {
    if (!contextDomain) {
      return;
    }

    setDomain(contextDomain);
    setResult(null);
    setError(null);
    setCopied(false);
    resetResultRegistration();
  }, [
    contextDomain,
    resetResultRegistration,
  ]);

  async function executeLookup():
    Promise<void> {
    setError(null);
    setCopied(false);
    resetResultRegistration();

    if (!domain.trim()) {
      setResult(null);

      setError(
        'Informe um domínio para consultar.',
      );

      return;
    }

    setBusy(true);

    try {
      const lookupResult =
        await window.zeroHub
          .osint
          .rdapDomain({
            domain,
          });

      setResult(
        lookupResult,
      );
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível concluir a consulta RDAP.',
      );
    } finally {
      setBusy(false);
    }
  }

  function clearLookup(): void {
    setDomain('');
    setResult(null);
    setError(null);
    setCopied(false);
    resetResultRegistration();
  }

  async function registerResult():
    Promise<void> {
    if (!result) {
      return;
    }

    await registerCaseResult({
      moduleId: 'osint',
      action:
        'rdap-domain-lookup',
      title:
        `Consulta RDAP: ${result.domain}`,
      status: 'success',
      input: {
        domain:
          result.domain,
      },
      output: result,
      note:
        `Consulta RDAP concluída com ${result.status.length} status e ${result.nameservers.length} nameservers.`,
      durationMs:
        result.elapsedMs,
    });
  }

  function copyJson(): void {
    if (!result) {
      return;
    }

    window.zeroHub
      .clipboard
      .writeText(
        result.rawJson,
      );

    setCopied(true);

    window.setTimeout(
      () => {
        setCopied(false);
      },
      1500,
    );
  }

  function handleKeyboard(
    event:
      KeyboardEvent<HTMLInputElement>,
  ): void {
    if (
      event.ctrlKey &&
      event.key === 'Enter'
    ) {
      event.preventDefault();

      void executeLookup();
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            OSINT · PYTHON
          </span>

          <h2>RDAP Domain Lookup</h2>

          <p>
            Consulte dados públicos de
            registro diretamente no
            servidor responsável pelo TLD.
          </p>
        </div>

        <span className="nativeToolBadge">
          Python Module
        </span>
      </div>

      <div className="rdapQueryBar">
        <label className="rdapDomainField">
          <span>Domínio</span>

          <input
            value={domain}
            type="text"
            disabled={registering}
            spellCheck={false}
            placeholder="example.com"
            onChange={(event) => {
              setDomain(
                event.target.value,
              );

              setResult(null);
              setError(null);
              setCopied(false);
              resetResultRegistration();
            }}
            onKeyDown={
              handleKeyboard
            }
          />
        </label>

        <button
          className="primaryButton rdapSubmit"
          type="button"
          disabled={
            busy || registering
          }
          onClick={() => {
            void executeLookup();
          }}
        >
          {busy
            ? 'Consultando...'
            : 'Consultar domínio'}
        </button>
      </div>

      {contextIp && (
        <div
          className="toolMessage info"
          role="status"
        >
          Contexto vindo do mapa: IP{' '}
          <strong>{contextIp}</strong>.
          {' '}Este módulo RDAP existente
          consulta domínios; use o IP como
          referência para a investigação
          complementar.
        </div>
      )}

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="rdapEmptyState">
          <span>RDAP</span>

          <h3>
            Nenhuma consulta executada
          </h3>

          <p>
            Informe um domínio completo
            para visualizar registro,
            status, nameservers e eventos.
          </p>
        </div>
      )}

      {result && (
        <div className="rdapResults">
          <div className="rdapSummary">
            <article>
              <span>DOMÍNIO</span>
              <strong>
                {result.domain}
              </strong>
            </article>

            <article>
              <span>HANDLE</span>
              <strong>
                {result.handle ??
                  'Não informado'}
              </strong>
            </article>

            <article>
              <span>DNSSEC</span>
              <strong>
                {result.secureDns ===
                null
                  ? 'Não informado'
                  : result.secureDns
                    ? 'Assinado'
                    : 'Não assinado'}
              </strong>
            </article>

            <article>
              <span>TEMPO</span>
              <strong>
                {result.elapsedMs} ms
              </strong>
            </article>
          </div>

          <div className="rdapGrid">
            <article className="rdapCard">
              <header>
                <span>STATUS</span>
                <strong>
                  {result.status.length}
                </strong>
              </header>

              <div className="rdapTagList">
                {result.status.length >
                0 ? (
                  result.status.map(
                    (status) => (
                      <span
                        key={status}
                      >
                        {status}
                      </span>
                    ),
                  )
                ) : (
                  <p>
                    Nenhum status
                    informado.
                  </p>
                )}
              </div>
            </article>

            <article className="rdapCard">
              <header>
                <span>NAMESERVERS</span>
                <strong>
                  {
                    result
                      .nameservers
                      .length
                  }
                </strong>
              </header>

              <div className="rdapList">
                {result.nameservers
                  .length > 0 ? (
                  result.nameservers.map(
                    (nameserver) => (
                      <code
                        key={nameserver}
                      >
                        {nameserver}
                      </code>
                    ),
                  )
                ) : (
                  <p>
                    Nenhum nameserver
                    informado.
                  </p>
                )}
              </div>
            </article>

            <article className="rdapCard">
              <header>
                <span>EVENTOS</span>
                <strong>
                  {
                    result.events
                      .length
                  }
                </strong>
              </header>

              <div className="rdapEventList">
                {result.events.length >
                0 ? (
                  result.events.map(
                    (
                      event,
                      index,
                    ) => (
                      <div
                        key={`${event.action}-${index}`}
                      >
                        <strong>
                          {
                            event.action
                          }
                        </strong>

                        <span>
                          {formatDate(
                            event.date,
                          )}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p>
                    Nenhum evento
                    informado.
                  </p>
                )}
              </div>
            </article>

            <article className="rdapCard">
              <header>
                <span>ENTIDADES</span>
                <strong>
                  {
                    result.entities
                      .length
                  }
                </strong>
              </header>

              <div className="rdapEntityList">
                {result.entities.length >
                0 ? (
                  result.entities.map(
                    (
                      entity,
                      index,
                    ) => (
                      <div
                        key={`${entity.handle}-${index}`}
                      >
                        <strong>
                          {entity.name ??
                            entity.handle ??
                            'Entidade'}
                        </strong>

                        <span>
                          {entity.roles
                            .join(', ') ||
                            'Função não informada'}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p>
                    Nenhuma entidade
                    pública informada.
                  </p>
                )}
              </div>
            </article>
          </div>

          <article className="rdapRawPanel">
            <header>
              <div>
                <span>RAW RESPONSE</span>

                <h3>JSON completo</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                onClick={copyJson}
              >
                {copied
                  ? 'Copiado'
                  : 'Copiar JSON'}
              </button>
            </header>

            <pre>
              {result.rawJson}
            </pre>
          </article>

          <div className="rdapSource">
            <span>Servidor consultado</span>
            <code>
              {result.sourceUrl}
            </code>
          </div>
        </div>
      )}

      {result && !activeCase && (
        <div
          className="toolMessage error"
          role="status"
        >
          Nenhum perfil ativo. Selecione
          um perfil para registrar esta
          consulta na timeline.
        </div>
      )}

      {result && lastRegisteredCase && (
        <div
          className="toolMessage success"
          role="status"
        >
          Consulta registrada na timeline
          de {lastRegisteredCase.name}.
        </div>
      )}

      {registrationError && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {registrationError}
        </div>
      )}

      <div className="toolFooter">
        <span className="keyboardHint">
          Ctrl + Enter para consultar
        </span>

        <div className="toolActions">
          {result && (
            <button
              className="primaryButton"
              type="button"
              disabled={
                registrationDisabled
              }
              onClick={() => {
                registerResult().catch(
                  (unknownError) => {
                    console.error(
                      'Falha inesperada ao registrar consulta RDAP.',
                      unknownError,
                    );
                  },
                );
              }}
            >
              {activeCase === null
                ? 'Selecione um perfil'
                : isRegisteredForActiveCase
                  ? 'Registrado no perfil'
                  : registering
                    ? 'Registrando...'
                    : 'Registrar no perfil'}
            </button>
          )}

          <button
            className="secondaryButton"
            type="button"
            disabled={registering}
            onClick={clearLookup}
          >
            Limpar
          </button>
        </div>
      </div>
    </section>
  );
}
