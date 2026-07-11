import {
  type KeyboardEvent,
  useState,
} from 'react';

import type {
  DnsLookupResult,
  DnsRecordType,
} from '../../../../shared/network/dns.types';

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
            spellCheck={false}
            placeholder="example.com"
            onChange={(event) => {
              setDomain(
                event.target.value,
              );

              setResult(null);
              setError(null);
              setCopied(false);
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
            onChange={(event) => {
              setRecordType(
                event.target
                  .value as DnsRecordType,
              );

              setResult(null);
              setError(null);
              setCopied(false);
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
          disabled={busy}
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

      <div className="toolFooter">
        <span className="keyboardHint">
          Ctrl + Enter para consultar
        </span>

        <div className="toolActions">
          <button
            className="secondaryButton"
            type="button"
            onClick={clearLookup}
          >
            Limpar
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={!result}
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
