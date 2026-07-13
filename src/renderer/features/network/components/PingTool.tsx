import {
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';

import type {
  PingRequest,
  PingResult,
} from '../../../../shared/network/ping.types';

import {
  useCaseResultRegistration,
} from '../../cases/useCaseResultRegistration';

export function PingTool() {
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
      'Não foi possível registrar o Ping no perfil.',
    missingCaseMessage:
      'Selecione um perfil ativo antes de registrar o Ping.',
  });

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
    resultRequest,
    setResultRequest,
  ] =
    useState<PingRequest | null>(
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

  const pingInFlight =
    useRef(false);

  const isSuccessfulResult =
    result?.success === true &&
    result.timedOut === false &&
    result.exitCode === 0;

  async function executePing():
    Promise<void> {
    if (
      pingInFlight.current ||
      registering
    ) {
      return;
    }

    setError(null);
    setCopied(false);
    resetResultRegistration();

    if (!target.trim()) {
      setResult(null);
      setResultRequest(null);

      setError(
        'Informe um IP ou hostname.',
      );

      return;
    }

    pingInFlight.current = true;
    setBusy(true);

    const request:
      PingRequest = {
        target,
        count:
          packetCount,
        timeoutMs,
      };

    try {
      const pingResult =
        await window.zeroHub
          .network
          .ping(request);

      setResult(pingResult);
      setResultRequest(request);
    } catch (unknownError) {
      setResult(null);
      setResultRequest(null);

      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível executar o Ping.',
      );
    } finally {
      pingInFlight.current = false;
      setBusy(false);
    }
  }

  function clearPing(): void {
    setTarget('');
    setResult(null);
    setResultRequest(null);
    setError(null);
    setCopied(false);
    resetResultRegistration();
  }

  async function registerResult():
    Promise<void> {
    if (
      !isSuccessfulResult ||
      !resultRequest ||
      busy
    ) {
      return;
    }

    await registerCaseResult({
      moduleId: 'network',
      action: 'ping',
      title:
        `Ping: ${result.target}`,
      status: 'success',
      input: {
        target:
          resultRequest.target,
        count:
          resultRequest.count,
        timeoutMs:
          resultRequest.timeoutMs,
      },
      output: result,
      note:
        `Ping concluído com sucesso em ${result.elapsedMs} ms usando ${resultRequest.count} ${resultRequest.count === 1 ? 'pacote' : 'pacotes'}.`,
      durationMs:
        result.elapsedMs,
    });
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
            disabled={registering}
            spellCheck={false}
            placeholder="1.1.1.1 ou google.com"
            onChange={(event) => {
              setTarget(
                event.target.value,
              );

              setResult(null);
              setResultRequest(null);
              setError(null);
              setCopied(false);
              resetResultRegistration();
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
            disabled={registering}
            onChange={(event) => {
              setPacketCount(
                Number(
                  event.target.value,
                ),
              );

              setResult(null);
              setResultRequest(null);
              resetResultRegistration();
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
            disabled={registering}
            onChange={(event) => {
              setTimeoutMs(
                Number(
                  event.target.value,
                ),
              );

              setResult(null);
              setResultRequest(null);
              resetResultRegistration();
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
          disabled={
            busy || registering
          }
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

      {isSuccessfulResult &&
        !activeCase && (
        <div
          className="toolMessage error"
          role="status"
        >
          Nenhum perfil ativo. Selecione
          um perfil para registrar este
          Ping na timeline.
        </div>
      )}

      {isSuccessfulResult &&
        lastRegisteredCase && (
        <div
          className="toolMessage success"
          role="status"
        >
          Ping registrado na timeline de
          {' '}
          {lastRegisteredCase.name}.
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
          Ctrl + Enter para executar
        </span>

        <div className="toolActions">
          {isSuccessfulResult && (
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
                      'Falha inesperada ao registrar Ping.',
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
            onClick={clearPing}
          >
            Limpar
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={
              !result || registering
            }
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
