import { useMemo, useState } from 'react';
import type {
  SecretScannerFinding,
  SecretScannerResult,
  SecretSeverity,
} from '../../../../shared/secret-scanner/secret-scanner.types';

type SeverityFilter = 'all' | SecretSeverity;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function label(severity: SecretSeverity): string {
  return ({ critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' })[severity];
}

function Finding({ finding }: { finding: SecretScannerFinding }) {
  return (
    <article className="secretFindingCard">
      <header>
        <div>
          <span className={`secretSeverity ${finding.severity}`}>{label(finding.severity)}</span>
          <strong>{finding.category}</strong>
        </div>
        <code>{finding.relativePath}:{finding.line}</code>
      </header>

      <div className="secretValue">
        <span>VALOR MASCARADO</span>
        <code>{finding.maskedValue}</code>
        <small>fingerprint: {finding.fingerprint}</small>
      </div>

      <div className="secretValue">
        <span>CONTEXTO REDIGIDO</span>
        <code>{finding.redactedContext}</code>
      </div>

      <p>{finding.description}</p>
      <p><strong>Correção:</strong> {finding.remediation}</p>

      {finding.exampleOrTestFile && (
        <span className="secretExampleBadge">Arquivo de exemplo/teste</span>
      )}
    </article>
  );
}

export function SecretScannerTool() {
  const [result, setResult] = useState<SecretScannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [copied, setCopied] = useState(false);

  const findings = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.findings.filter((finding) => {
      if (severity !== 'all' && finding.severity !== severity) return false;
      if (!q) return true;
      return [finding.category, finding.relativePath, finding.ruleId, finding.description]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [query, result, severity]);

  async function run(kind: 'file' | 'folder'): Promise<void> {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const next = kind === 'file'
        ? await window.zeroHub.secretScanner.scanFile()
        : await window.zeroHub.secretScanner.scanFolder();
      if (next) setResult(next);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'A varredura falhou.');
    } finally {
      setBusy(false);
    }
  }

  function copyReport(): void {
    if (!result) return;
    window.zeroHub.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">SECRET SCANNER · PYTHON</span>
          <h2>Project Secrets</h2>
          <p>Auditoria local de tokens, chaves, senhas e arquivos .env.</p>
        </div>
        <span className="nativeToolBadge">Local Only</span>
      </div>

      <div className="secretToolbar">
        <div>
          <strong>Escolha o escopo</strong>
          <span>Os valores são mascarados e nenhum arquivo é enviado.</span>
        </div>
        <div>
          <button className="secondaryButton" disabled={busy} onClick={() => void run('file')}>Escanear arquivo</button>
          <button className="primaryButton" disabled={busy} onClick={() => void run('folder')}>
            {busy ? 'Escaneando...' : 'Escanear pasta/projeto'}
          </button>
        </div>
      </div>

      {error && <div className="toolMessage error" role="alert">{error}</div>}

      {!result && !error && (
        <div className="secretEmpty">
          <span>SEC</span>
          <h3>Nenhuma varredura executada</h3>
          <p>Detecta tokens, private keys, JWTs, credenciais em URLs, senhas e arquivos de ambiente.</p>
        </div>
      )}

      {result && (
        <div className="secretResults">
          <div className="secretTarget">
            <code>{result.targetPath}</code>
            <strong>{result.summary.total} achado{result.summary.total === 1 ? '' : 's'}</strong>
          </div>

          <div className="secretSummary">
            <article className="critical"><span>CRÍTICO</span><strong>{result.summary.critical}</strong></article>
            <article className="high"><span>ALTO</span><strong>{result.summary.high}</strong></article>
            <article className="medium"><span>MÉDIO</span><strong>{result.summary.medium}</strong></article>
            <article className="low"><span>BAIXO</span><strong>{result.summary.low}</strong></article>
          </div>

          <div className="secretStats">
            <span>Analisados: <strong>{result.scannedFiles}</strong></span>
            <span>Ignorados: <strong>{result.skippedFiles}</strong></span>
            <span>Lidos: <strong>{formatBytes(result.totalBytes)}</strong></span>
            <span>Tempo: <strong>{result.durationMs} ms</strong></span>
            {result.truncated && <span className="warning">Resultado limitado.</span>}
          </div>

          <div className="secretFilters">
            <input value={query} type="search" placeholder="Filtrar por arquivo, regra ou categoria" onChange={(event) => setQuery(event.target.value)} />
            <select value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}>
              <option value="all">Todas as severidades</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
            <button className="secondaryButton" onClick={copyReport}>{copied ? 'Copiado' : 'Copiar relatório'}</button>
          </div>

          {findings.length > 0 ? (
            <div className="secretFindings">{findings.map((finding) => <Finding key={finding.id} finding={finding} />)}</div>
          ) : (
            <div className="secretNoFindings"><strong>Nenhum achado neste filtro</strong><span>Ajuste a busca ou severidade.</span></div>
          )}
        </div>
      )}
    </section>
  );
}
