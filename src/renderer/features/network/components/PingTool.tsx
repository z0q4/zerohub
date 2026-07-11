import {
  type KeyboardEvent,
  useState,
} from 'react';

import type {
  PingResult,
} from '../../../../shared/network/ping.types';

export function PingTool() {
  const [
    target,
    setTarget,
  ] = useState('');

  const [
    packetCount,
    setPacketCount,
  ] = useState(4);

  const [
    timeoutMs,
    setTimeoutMs,
  ] = useState(2000);

  const [
    result,
    setResult,
  ] =
    useState<PingResult | null>(
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

  async function executePing():
    Promise<void> {
    setError(null);
    setCopied(false);

    if (!target.trim()) {
      setResult(null);

      setError(
        'Informe um IP ou hostname.',
      );

      return;
    }

    setBusy(true);

    try {
      const pingResult =
        await window.zeroHub
          .network
          .ping({
            target,
            count:
              packetCount,
            timeoutMs,
          });

      setResult(pingResult);
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível executar o Ping.',
      );
    } finally {
      setBusy(false);
    }
  }

  function clearPing(): void {
    setTarget('');
    setResult(null);
    setError(null);
    setCopied(false);
  }

  function copyOutput(): void {
    if (!result) {
      return;
    }

    window.zeroHub
      .clipboard
      .writeText(
        result.output,
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
      event.key ===
        'Enter'
    ) {
      event.preventDefault();

      void executePing();
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            NETWORK · PYTHON
          </span>

          <h2>Ping</h2>

          <p>
            Teste conectividade,
            resolução e tempo de
            resposta de um host.
          </p>
        </div>

        <span className="nativeToolBadge">
          Python Module
        </span>
      </div>

      <div className="pingQueryBar">
        <label className="pingTargetField">
          <span>IP ou hostname</span>

          <input
            value={target}
            type="text"
            spellCheck={false}
            placeholder="1.1.1.1 ou google.com"
            onChange={(event) => {
              setTarget(
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

        <label className="pingOptionField">
          <span>Pacotes</span>

          <select
            value={packetCount}
            onChange={(event) => {
              setPacketCount(
                Number(
                  event.target.value,
                ),
              );

              setResult(null);
            }}
          >
            {[1, 2, 3, 4, 5, 8, 10].map(
              (count) => (
                <option
                  key={count}
                  value={count}
                >
                  {count}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="pingOptionField">
          <span>Timeout</span>

          <select
            value={timeoutMs}
            onChange={(event) => {
              setTimeoutMs(
                Number(
                  event.target.value,
                ),
              );

              setResult(null);
            }}
          >
            <option value={1000}>
              1 segundo
            </option>

            <option value={2000}>
              2 segundos
            </option>

            <option value={3000}>
              3 segundos
            </option>

            <option value={5000}>
              5 segundos
            </option>
          </select>
        </label>

        <button
          className="primaryButton pingSubmit"
          type="button"
          disabled={busy}
          onClick={() => {
            void executePing();
          }}
        >
          {busy
            ? 'Executando...'
            : 'Executar Ping'}
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

      <div className="pingResultPanel">
        <div className="pingResultHeader">
          <div>
            <span>
              COMMAND OUTPUT
            </span>

            <h3>
              {result
                ? result.target
                : 'Nenhum Ping executado'}
            </h3>
          </div>

          {result && (
            <div className="pingMetadata">
              <span
                className={
                  result.success
                    ? 'success'
                    : 'failure'
                }
              >
                {result.success
                  ? 'Sucesso'
                  : result.timedOut
                    ? 'Timeout'
                    : 'Falhou'}
              </span>

              <span>
                {result.elapsedMs}
                {' '}ms
              </span>

              <span>
                Exit{' '}
                {result.exitCode ??
                  '—'}
              </span>
            </div>
          )}
        </div>

        <pre className="pingOutput">
          {result?.output ??
            'A saída do comando ping aparecerá aqui.'}
        </pre>
      </div>

      <div className="toolFooter">
        <span className="keyboardHint">
          Ctrl + Enter para executar
        </span>

        <div className="toolActions">
          <button
            className="secondaryButton"
            type="button"
            onClick={clearPing}
          >
            Limpar
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={!result}
            onClick={copyOutput}
          >
            {copied
              ? 'Copiado'
              : 'Copiar saída'}
          </button>
        </div>
      </div>
    </section>
  );
}
