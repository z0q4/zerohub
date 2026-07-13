import {
  type KeyboardEvent,
  useState,
} from 'react';

import type {
  DnsLookupResult,
  DnsRecordType,
} from '../../../../shared/network/dns.types';

import {
  useCaseResultRegistration,
} from '../../cases/useCaseResultRegistration';

const RECORD_TYPES:
  readonly DnsRecordType[] = [
    'A',
    'AAAA',
    'MX',
    'TXT',
    'NS',
    'CNAME',
  ];

export function DnsLookupTool() {
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
      'Não foi possível registrar a consulta DNS no perfil.',
    missingCaseMessage:
      'Selecione um perfil ativo antes de registrar a consulta DNS.',
  });

  const [
    domain,
    setDomain,
  ] = useState('');

  const [
    recordType,
    setRecordType,
  ] =
    useState<DnsRecordType>('A');

  const [
    result,
    setResult,
  ] =
    useState<DnsLookupResult | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    copied,
    setCopied,
  ] = useState(false);

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
        await window.zeroHub.network
          .dnsLookup({
            domain,
            recordType,
          });

      setResult(lookupResult);
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível concluir a consulta DNS.',
      );
    } finally {
      setBusy(false);
    }
  }

  function copyRecords(): void {
    if (!result) {
      return;
    }

    window.zeroHub.clipboard
      .writeText(
        result.records.join('\n'),
      );

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
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
    if (
      !result ||
      busy
    ) {
      return;
    }

    await registerCaseResult({
      moduleId: 'network',
      action: 'dns-lookup',
      title:
        `Consulta DNS: ${result.domain} · ${result.recordType}`,
      status: 'success',
      input: {
        domain:
          result.domain,
        recordType:
          result.recordType,
      },
      output: result,
      note:
        `Consulta DNS ${result.recordType} concluída com ${result.records.length} ${result.records.length === 1 ? 'registro' : 'registros'}.`,
      durationMs:
        result.elapsedMs,
    });
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
            NETWORK · PYTHON
          </span>

          <h2>DNS Lookup</h2>

          <p>
            Consulte registros DNS utilizando
            o resolvedor configurado no sistema.
          </p>
        </div>

        <span className="nativeToolBadge">
          Python Module
        </span>
      </div>

      <div className="dnsQueryBar">
        <label className="dnsDomainField">
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

        <label className="dnsTypeField">
          <span>Registro</span>

          <select
            value={recordType}
            disabled={registering}
            onChange={(event) => {
              setRecordType(
                event.target
                  .value as DnsRecordType,
              );

              setResult(null);
              setError(null);
              setCopied(false);
              resetResultRegistration();
            }}
          >
            {RECORD_TYPES.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          className="primaryButton dnsSubmit"
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
            : 'Consultar'}
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

      <div className="dnsResultPanel">
        <div className="dnsResultHeader">
          <div>
            <span>RESULTADO</span>

            <h3>
              {result
                ? `${result.domain} · ${result.recordType}`
                : 'Nenhuma consulta executada'}
            </h3>
          </div>

          {result && (
            <div className="dnsMetadata">
              <span>
                {result.records.length}
                {' '}
                {result.records.length === 1
                  ? 'registro'
                  : 'registros'}
              </span>

              <span>
                {result.elapsedMs} ms
              </span>
            </div>
          )}
        </div>

        {result ? (
          <div className="dnsRecordList">
            {result.records.map(
              (record, index) => (
                <div
                  className="dnsRecord"
                  key={`${record}-${index}`}
                >
                  <span>
                    {String(
                      index + 1,
                    ).padStart(2, '0')}
                  </span>

                  <code>{record}</code>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="dnsEmptyResult">
            <span>DNS</span>

            <p>
              Informe um domínio, escolha o
              tipo de registro e execute a
              consulta.
            </p>
          </div>
        )}
      </div>

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
                busy ||
                registrationDisabled
              }
              onClick={() => {
                registerResult().catch(
                  (unknownError) => {
                    console.error(
                      'Falha inesperada ao registrar consulta DNS.',
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

          <button
            className="secondaryButton"
            type="button"
            disabled={
              !result || registering
            }
            onClick={copyRecords}
          >
            {copied
              ? 'Copiado'
              : 'Copiar registros'}
          </button>
        </div>
      </div>
    </section>
  );
}
