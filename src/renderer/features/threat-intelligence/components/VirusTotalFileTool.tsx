import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  VirusTotalSecretStatus,
  VirusTotalTargetResult,
} from '../../../../shared/threat-intelligence/threat-intelligence.types';

type ScannerMode = 'file' | 'url';

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Não informado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function verdictLabel(result: VirusTotalTargetResult): string {
  if (result.state === 'missing') {
    return 'Sem relatório';
  }

  if (result.state === 'processing') {
    return 'Análise em andamento';
  }

  switch (result.report?.verdict) {
    case 'malicious':
      return 'Detectado como malicioso';
    case 'suspicious':
      return 'Resultado suspeito';
    default:
      return 'Sem detecções';
  }
}

export function VirusTotalFileTool() {
  const [mode, setMode] = useState<ScannerMode>('file');
  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] =
    useState<VirusTotalSecretStatus | null>(null);
  const [result, setResult] =
    useState<VirusTotalTargetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.zeroHub.threatIntelligence
      .getVirusTotalStatus()
      .then(setStatus)
      .catch((unknownError) => {
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : 'Não foi possível verificar a configuração.',
        );
      });
  }, []);

  const detectedEngines = useMemo(
    () =>
      result?.report?.engines.filter(
        (engine) =>
          engine.category === 'malicious' ||
          engine.category === 'suspicious',
      ) ?? [],
    [result],
  );

  function begin(): void {
    setBusy(true);
    setError(null);
    setMessage(null);
  }

  function fail(unknownError: unknown): void {
    setError(
      unknownError instanceof Error
        ? unknownError.message
        : 'A operação falhou.',
    );
  }

  function apply(next: VirusTotalTargetResult | null): void {
    if (!next) {
      return;
    }

    setResult(next);
    setMessage(next.message);
  }

  async function saveKey(): Promise<void> {
    begin();
    try {
      setStatus(
        await window.zeroHub.threatIntelligence
          .saveVirusTotalApiKey(apiKey),
      );
      setApiKey('');
      setMessage('Chave da API salva.');
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(): Promise<void> {
    begin();
    try {
      setStatus(
        await window.zeroHub.threatIntelligence
          .removeVirusTotalApiKey(),
      );
      setResult(null);
      setMessage('Chave removida.');
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function lookupFile(): Promise<void> {
    begin();
    try {
      apply(
        await window.zeroHub.threatIntelligence
          .lookupVirusTotalFile(),
      );
    } catch (unknownError) {
      setResult(null);
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function refreshFile(): Promise<void> {
    begin();
    try {
      apply(
        await window.zeroHub.threatIntelligence
          .refreshVirusTotalFile(),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(): Promise<void> {
    begin();
    try {
      apply(
        await window.zeroHub.threatIntelligence
          .uploadVirusTotalFile(),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function lookupUrl(): Promise<void> {
    begin();
    try {
      apply(
        await window.zeroHub.threatIntelligence
          .lookupVirusTotalUrl(url),
      );
    } catch (unknownError) {
      setResult(null);
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function scanUrl(): Promise<void> {
    begin();
    try {
      apply(
        await window.zeroHub.threatIntelligence
          .scanVirusTotalUrl(url),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function openReport(): Promise<void> {
    if (!result) {
      return;
    }

    try {
      await window.zeroHub.threatIntelligence
        .openVirusTotalReport(result.reportUrl);
    } catch (unknownError) {
      fail(unknownError);
    }
  }

  function switchMode(nextMode: ScannerMode): void {
    setMode(nextMode);
    setResult(null);
    setError(null);
    setMessage(null);
  }

  const report = result?.report ?? null;

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            THREAT INTELLIGENCE · PYTHON
          </span>

          <h2>VirusTotal Scanner</h2>

          <p>
            Consulte relatórios existentes ou envie
            arquivos e URLs para análise.
          </p>
        </div>

        <span className="nativeToolBadge">
          File + URL
        </span>
      </div>

      <div className="vtConfiguration">
        <div className="vtConfigurationHeader">
          <div>
            <strong>VirusTotal API</strong>
            <span>
              {status?.configured
                ? 'Chave configurada'
                : 'Chave não configurada'}
            </span>
          </div>

          <span
            className={`vtApiStatus ${status?.configured ? 'configured' : ''}`}
          >
            {status?.configured ? 'Ativa' : 'Pendente'}
          </span>
        </div>

        <div className="vtKeyRow">
          <input
            value={apiKey}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Cole sua API key do VirusTotal"
            disabled={busy}
            onChange={(event) => setApiKey(event.target.value)}
          />

          <button
            className="primaryButton"
            type="button"
            disabled={busy || !apiKey.trim()}
            onClick={() => void saveKey()}
          >
            Salvar chave
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={busy || !status?.configured}
            onClick={() => void removeKey()}
          >
            Remover
          </button>
        </div>

        {status && (
          <div className="vtStorageStatus">
            <span>
              Backend: <code>{status.storageBackend}</code>
            </span>

            <span className={status.protectedByOs ? 'protected' : 'warning'}>
              {status.protectedByOs
                ? 'Protegida pelo sistema'
                : 'Proteção limitada'}
            </span>
          </div>
        )}
      </div>

      <div className="vtModeTabs">
        <button
          className={mode === 'file' ? 'active' : ''}
          type="button"
          onClick={() => switchMode('file')}
        >
          Arquivo
        </button>

        <button
          className={mode === 'url' ? 'active' : ''}
          type="button"
          onClick={() => switchMode('url')}
        >
          URL / site
        </button>
      </div>

      {mode === 'file' ? (
        <div className="vtLookupToolbar">
          <div>
            <strong>Analisar arquivo</strong>
            <span>
              Primeiro consulta o hash. O upload só ocorre
              após sua confirmação.
            </span>
          </div>

          <button
            className="primaryButton"
            type="button"
            disabled={busy || !status?.configured}
            onClick={() => void lookupFile()}
          >
            {busy ? 'Processando...' : 'Selecionar arquivo'}
          </button>
        </div>
      ) : (
        <div className="vtUrlPanel">
          <div>
            <strong>Analisar URL</strong>
            <span>
              Consulte um relatório ou envie a URL
              para uma nova análise.
            </span>
          </div>

          <div className="vtUrlRow">
            <input
              value={url}
              type="url"
              placeholder="https://exemplo.com"
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setUrl(event.target.value)}
            />

            <button
              className="secondaryButton"
              type="button"
              disabled={busy || !status?.configured || !url.trim()}
              onClick={() => void lookupUrl()}
            >
              Consultar
            </button>

            <button
              className="primaryButton"
              type="button"
              disabled={busy || !status?.configured || !url.trim()}
              onClick={() => void scanUrl()}
            >
              Enviar e analisar
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="toolMessage success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="toolMessage error" role="alert">
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="vtEmptyState">
          <span>VT</span>
          <h3>Nenhum relatório carregado</h3>
          <p>Consulte um arquivo por hash ou analise uma URL.</p>
        </div>
      )}

      {result && (
        <div className="vtResults">
          <div className={`vtVerdict ${report?.verdict ?? result.state}`}>
            <div>
              <span>{result.targetType === 'file' ? 'ARQUIVO' : 'URL'}</span>
              <h3>{verdictLabel(result)}</h3>
              <p>{result.displayName}</p>
            </div>

            <strong>
              {report
                ? `${report.detectedEngines} / ${report.totalEngines}`
                : result.state === 'processing'
                  ? '...'
                  : '0'}
            </strong>
          </div>

          {result.state !== 'found' && (
            <div className="vtPendingActions">
              <div>
                <strong>
                  {result.state === 'missing'
                    ? 'Ainda não analisado'
                    : 'Processando'}
                </strong>
                <span>{result.message}</span>
              </div>

              <div>
                {result.targetType === 'file' && result.state === 'missing' && (
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={busy}
                    onClick={() => void uploadFile()}
                  >
                    Enviar e analisar
                  </button>
                )}

                {result.targetType === 'file' && result.state === 'processing' && (
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={busy}
                    onClick={() => void refreshFile()}
                  >
                    Atualizar resultado
                  </button>
                )}

                {result.targetType === 'url' && (
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (result.state === 'missing') {
                        void scanUrl();
                      } else {
                        void lookupUrl();
                      }
                    }}
                  >
                    {result.state === 'missing'
                      ? 'Enviar e analisar'
                      : 'Atualizar resultado'}
                  </button>
                )}
              </div>
            </div>
          )}

          {report && (
            <>
              <div className="vtStatsGrid">
                <article className="malicious">
                  <span>MALICIOSO</span>
                  <strong>{report.stats.malicious}</strong>
                </article>
                <article className="suspicious">
                  <span>SUSPEITO</span>
                  <strong>{report.stats.suspicious}</strong>
                </article>
                <article>
                  <span>NÃO DETECTADO</span>
                  <strong>{report.stats.undetected}</strong>
                </article>
                <article>
                  <span>INOFENSIVO</span>
                  <strong>{report.stats.harmless}</strong>
                </article>
              </div>

              <div className="vtInformationGrid">
                <article className="vtCard">
                  <header><span>ALVO</span></header>
                  <dl>
                    <div>
                      <dt>Nome</dt>
                      <dd>
                        {report.meaningfulName ?? report.title ?? result.displayName}
                      </dd>
                    </div>
                    <div>
                      <dt>Tipo</dt>
                      <dd>{report.typeDescription ?? result.targetType}</dd>
                    </div>
                    {result.localFile && (
                      <div>
                        <dt>Tamanho</dt>
                        <dd>{formatBytes(result.localFile.sizeBytes)}</dd>
                      </div>
                    )}
                    {report.httpResponseCode !== null && (
                      <div>
                        <dt>HTTP</dt>
                        <dd>{report.httpResponseCode}</dd>
                      </div>
                    )}
                  </dl>
                </article>

                <article className="vtCard">
                  <header><span>VIRUSTOTAL</span></header>
                  <dl>
                    <div>
                      <dt>Reputação</dt>
                      <dd>{report.reputation}</dd>
                    </div>
                    <div>
                      <dt>Submissões</dt>
                      <dd>{report.timesSubmitted}</dd>
                    </div>
                    <div>
                      <dt>Primeira submissão</dt>
                      <dd>{formatDate(report.firstSubmissionAt)}</dd>
                    </div>
                    <div>
                      <dt>Última análise</dt>
                      <dd>{formatDate(report.lastAnalysisAt)}</dd>
                    </div>
                  </dl>
                </article>
              </div>

              <article className="vtEnginesCard">
                <header>
                  <div>
                    <span>DETECÇÕES</span>
                    <h3>Resultados positivos</h3>
                  </div>
                  <strong>{detectedEngines.length}</strong>
                </header>

                {detectedEngines.length > 0 ? (
                  <div className="vtEngineList">
                    {detectedEngines.map((engine, index) => (
                      <div key={`${engine.engineName}-${index}`}>
                        <strong>{engine.engineName}</strong>
                        <span>{engine.result ?? engine.category}</span>
                        <code>{engine.category}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="vtNoDetections">
                    Nenhum mecanismo classificou o alvo como malicioso
                    ou suspeito. Isso não garante que ele seja seguro.
                  </p>
                )}
              </article>
            </>
          )}

          <div className="vtReportActions">
            {result.localFile && (
              <code>SHA-256: {result.localFile.sha256}</code>
            )}

            {result.state !== 'missing' && (
              <button
                className="secondaryButton"
                type="button"
                onClick={() => void openReport()}
              >
                Abrir relatório no VirusTotal
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
