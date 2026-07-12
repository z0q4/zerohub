import {
  useState,
} from 'react';

import type {
  FileAnalysisResult,
} from '../../../../shared/file-analysis/file-analysis.types';

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

  const unitIndex =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  const value =
    bytes /
    1024 ** unitIndex;

  return `${value.toFixed(
    unitIndex === 0 ? 0 : 2,
  )} ${units[unitIndex]}`;
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Não disponível';
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
      timeStyle: 'medium',
    },
  ).format(date);
}

export function FileInspectorTool() {
  const [
    result,
    setResult,
  ] =
    useState<FileAnalysisResult | null>(
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

  async function selectFile():
    Promise<void> {
    setBusy(true);
    setError(null);
    setCopied(false);

    try {
      const analysis =
        await window.zeroHub
          .fileAnalysis
          .inspectFile();

      if (analysis) {
        setResult(analysis);
      }
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível analisar o arquivo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function copyReport(): void {
    if (!result) {
      return;
    }

    window.zeroHub
      .clipboard
      .writeText(
        JSON.stringify(
          result,
          null,
          2,
        ),
      );

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            FILE ANALYSIS · PYTHON
          </span>

          <h2>File Inspector</h2>

          <p>
            Analise estrutura, integridade,
            entropia e metadados de um
            arquivo local.
          </p>
        </div>

        <span className="nativeToolBadge">
          Python Module
        </span>
      </div>

      <div className="fileAnalysisToolbar">
        <div>
          <strong>
            Arquivo local
          </strong>

          <span>
            O processamento ocorre
            localmente no computador.
          </span>
        </div>

        <button
          className="primaryButton"
          type="button"
          disabled={busy}
          onClick={() => {
            void selectFile();
          }}
        >
          {busy
            ? 'Analisando...'
            : 'Selecionar arquivo'}
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
        <div className="fileAnalysisEmpty">
          <span>FIL</span>

          <h3>
            Nenhum arquivo analisado
          </h3>

          <p>
            Selecione um arquivo para
            calcular hashes, entropia,
            assinatura inicial e
            metadados.
          </p>
        </div>
      )}

      {result && (
        <div className="fileAnalysisResults">
          <div className="fileAnalysisHero">
            <div>
              <span>ARQUIVO</span>

              <h3>
                {result.fileName}
              </h3>

              <code>
                {result.filePath}
              </code>
            </div>

            <span
              className={`fileKindBadge ${result.kind}`}
            >
              {result.kind === 'text'
                ? 'Texto'
                : 'Binário'}
            </span>
          </div>

          <div className="fileAnalysisSummary">
            <article>
              <span>TAMANHO</span>
              <strong>
                {formatBytes(
                  result.sizeBytes,
                )}
              </strong>
            </article>

            <article>
              <span>TIPO MIME</span>
              <strong>
                {result.mimeType}
              </strong>
            </article>

            <article>
              <span>EXTENSÃO</span>
              <strong>
                {result.extension ??
                  'Sem extensão'}
              </strong>
            </article>

            <article>
              <span>ENTROPIA</span>
              <strong>
                {result.entropy}
                {' / 8'}
              </strong>
            </article>
          </div>

          <div className="fileAnalysisGrid">
            <article className="fileAnalysisCard">
              <header>
                <span>INTEGRIDADE</span>
              </header>

              <div className="hashInformation">
                <label>
                  <span>SHA-256</span>
                  <code>
                    {result.sha256}
                  </code>
                </label>

                <label>
                  <span>SHA-512</span>
                  <code>
                    {result.sha512}
                  </code>
                </label>
              </div>
            </article>

            <article className="fileAnalysisCard">
              <header>
                <span>CONTEÚDO</span>
              </header>

              <dl>
                <div>
                  <dt>Classificação</dt>
                  <dd>
                    {result.kind}
                  </dd>
                </div>

                <div>
                  <dt>Codificação</dt>
                  <dd>
                    {result.encoding ??
                      'Não aplicável'}
                  </dd>
                </div>

                <div>
                  <dt>Linhas</dt>
                  <dd>
                    {result.lineCount ??
                      'Não aplicável'}
                  </dd>
                </div>

                <div>
                  <dt>Magic bytes</dt>
                  <dd>
                    <code>
                      {result.magicHex ||
                        'Arquivo vazio'}
                    </code>
                  </dd>
                </div>
              </dl>
            </article>

            <article className="fileAnalysisCard">
              <header>
                <span>SISTEMA DE ARQUIVOS</span>
              </header>

              <dl>
                <div>
                  <dt>Permissões</dt>
                  <dd>
                    {result.permissions}
                    {' '}
                    ({result.permissionsOctal})
                  </dd>
                </div>

                <div>
                  <dt>Executável</dt>
                  <dd>
                    {result.isExecutable
                      ? 'Sim'
                      : 'Não'}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="fileAnalysisCard">
              <header>
                <span>DATAS</span>
              </header>

              <dl>
                <div>
                  <dt>Criação</dt>
                  <dd>
                    {formatDate(
                      result.createdAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Modificação</dt>
                  <dd>
                    {formatDate(
                      result.modifiedAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Alteração de metadados</dt>
                  <dd>
                    {formatDate(
                      result.changedAt,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
        </div>
      )}

      <div className="toolFooter">
        <span className="keyboardHint">
          Análise local em streaming
        </span>

        <div className="toolActions">
          <button
            className="secondaryButton"
            type="button"
            disabled={!result}
            onClick={copyReport}
          >
            {copied
              ? 'Copiado'
              : 'Copiar relatório'}
          </button>

          <button
            className="primaryButton"
            type="button"
            disabled={busy}
            onClick={() => {
              void selectFile();
            }}
          >
            Analisar outro arquivo
          </button>
        </div>
      </div>
    </section>
  );
}
