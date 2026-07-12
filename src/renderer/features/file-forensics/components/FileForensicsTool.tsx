import {
  useMemo,
  useState,
} from 'react';

import type {
  FileForensicsResult,
  ForensicString,
} from '../../../../shared/file-forensics/file-forensics.types';

type ViewTab =
  | 'overview'
  | 'indicators'
  | 'strings'
  | 'archive';

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

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  return `${(
    bytes /
    1024 ** index
  ).toFixed(
    index === 0 ? 0 : 2,
  )} ${units[index]}`;
}

function formatOffset(
  offset: number,
): string {
  return `0x${offset
    .toString(16)
    .padStart(8, '0')}`;
}

function stringifyDetail(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return 'Não informado';
  }

  if (
    typeof value === 'object'
  ) {
    return JSON.stringify(value);
  }

  return String(value);
}

function IndicatorGroup({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <article className="forensicsCard">
      <header>
        <span>{title}</span>
        <strong>{values.length}</strong>
      </header>

      {values.length === 0 ? (
        <p className="forensicsEmptyText">
          Nenhum indicador encontrado.
        </p>
      ) : (
        <div className="forensicsValueList">
          {values.map(
            (value) => (
              <button
                key={value}
                type="button"
                title="Copiar"
                onClick={() => {
                  window.zeroHub
                    .clipboard
                    .writeText(value);
                }}
              >
                <code>{value}</code>
              </button>
            ),
          )}
        </div>
      )}
    </article>
  );
}

export function FileForensicsTool() {
  const [
    result,
    setResult,
  ] =
    useState<FileForensicsResult | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ViewTab>(
      'overview',
    );

  const [
    minStringLength,
    setMinStringLength,
  ] = useState(5);

  const [
    stringFilter,
    setStringFilter,
  ] = useState('');

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

  const filteredStrings =
    useMemo<ForensicString[]>(
      () => {
        if (!result) {
          return [];
        }

        const query =
          stringFilter
            .trim()
            .toLowerCase();

        if (!query) {
          return result.strings;
        }

        return result.strings.filter(
          (item) =>
            item.value
              .toLowerCase()
              .includes(query),
        );
      },
      [
        result,
        stringFilter,
      ],
    );

  async function inspectFile():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const analysis =
        await window.zeroHub
          .fileForensics
          .inspectFile(
            minStringLength,
          );

      if (analysis) {
        setResult(analysis);
        setActiveTab('overview');
        setStringFilter('');
      }
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível analisar o arquivo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            FILE FORENSICS · PYTHON
          </span>

          <h2>Static File Forensics</h2>

          <p>
            Extraia strings, indicadores,
            metadados binários e conteúdo de
            arquivos ZIP sem executar nada.
          </p>
        </div>

        <span className="nativeToolBadge">
          Static Analysis
        </span>
      </div>

      <div className="forensicsToolbar">
        <label>
          <span>
            Tamanho mínimo das strings
          </span>

          <input
            value={minStringLength}
            type="number"
            min={4}
            max={64}
            disabled={busy}
            onChange={(event) => {
              setMinStringLength(
                Number(
                  event.target.value,
                ),
              );
            }}
          />
        </label>

        <button
          className="primaryButton"
          type="button"
          disabled={busy}
          onClick={() => {
            void inspectFile();
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
        <div className="forensicsEmpty">
          <span>FF</span>

          <h3>
            Nenhum arquivo analisado
          </h3>

          <p>
            Selecione um executável,
            documento, imagem ou arquivo
            compactado.
          </p>
        </div>
      )}

      {result && (
        <div className="forensicsResults">
          <div className="forensicsHero">
            <div>
              <span>ARQUIVO</span>

              <h3>
                {result.fileName}
              </h3>

              <code>
                {result.filePath}
              </code>
            </div>

            <div>
              <strong>
                {result.formatName}
              </strong>

              <small>
                {result.mimeType}
              </small>
            </div>
          </div>

          <div className="forensicsStats">
            <article>
              <span>TAMANHO</span>
              <strong>
                {formatBytes(
                  result.sizeBytes,
                )}
              </strong>
            </article>

            <article>
              <span>ENTROPIA</span>
              <strong>
                {result.entropy} / 8
              </strong>
            </article>

            <article>
              <span>STRINGS</span>
              <strong>
                {
                  result.stringStats
                    .total
                }
              </strong>
            </article>

            <article>
              <span>INDICADORES</span>
              <strong>
                {
                  Object.values(
                    result.indicators,
                  ).reduce(
                    (
                      total,
                      values,
                    ) =>
                      total +
                      values.length,
                    0,
                  )
                }
              </strong>
            </article>
          </div>

          <div className="forensicsTabs">
            {(
              [
                [
                  'overview',
                  'Resumo',
                ],
                [
                  'indicators',
                  'Indicadores',
                ],
                [
                  'strings',
                  'Strings',
                ],
                [
                  'archive',
                  'Arquivo ZIP',
                ],
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
                  disabled={
                    id === 'archive' &&
                    !result.archive
                  }
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
            'overview' && (
            <div className="forensicsGrid">
              <article className="forensicsCard">
                <header>
                  <span>HASHES</span>
                </header>

                <dl>
                  <div>
                    <dt>MD5</dt>
                    <dd>
                      <code>
                        {result.md5}
                      </code>
                    </dd>
                  </div>

                  <div>
                    <dt>SHA-1</dt>
                    <dd>
                      <code>
                        {result.sha1}
                      </code>
                    </dd>
                  </div>

                  <div>
                    <dt>SHA-256</dt>
                    <dd>
                      <code>
                        {result.sha256}
                      </code>
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="forensicsCard">
                <header>
                  <span>
                    CABEÇALHO / FORMATO
                  </span>
                </header>

                <dl>
                  {Object.entries(
                    result.formatDetails,
                  ).map(
                    ([
                      key,
                      value,
                    ]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {stringifyDetail(
                            value,
                          )}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </article>

              <article className="forensicsCard">
                <header>
                  <span>STRINGS</span>
                </header>

                <dl>
                  <div>
                    <dt>ASCII</dt>
                    <dd>
                      {
                        result.stringStats
                          .asciiCount
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>UTF-16LE</dt>
                    <dd>
                      {
                        result.stringStats
                          .utf16Count
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Limite</dt>
                    <dd>
                      {
                        result.stringStats
                          .limit
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Truncado</dt>
                    <dd>
                      {result.stringStats
                        .truncated
                        ? 'Sim'
                        : 'Não'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="forensicsCard">
                <header>
                  <span>ARQUIVO</span>
                </header>

                <dl>
                  <div>
                    <dt>Extensão</dt>
                    <dd>
                      {result.extension ??
                        'Sem extensão'}
                    </dd>
                  </div>

                  <div>
                    <dt>MIME</dt>
                    <dd>
                      {result.mimeType}
                    </dd>
                  </div>

                  <div>
                    <dt>Formato</dt>
                    <dd>
                      {result.formatName}
                    </dd>
                  </div>

                  <div>
                    <dt>Modificação</dt>
                    <dd>
                      {new Date(
                        result.modifiedAt,
                      ).toLocaleString(
                        'pt-BR',
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          )}

          {activeTab ===
            'indicators' && (
            <div className="forensicsGrid">
              <IndicatorGroup
                title="URLS"
                values={
                  result.indicators
                    .urls
                }
              />

              <IndicatorGroup
                title="DOMÍNIOS"
                values={
                  result.indicators
                    .domains
                }
              />

              <IndicatorGroup
                title="IPV4"
                values={
                  result.indicators
                    .ipv4
                }
              />

              <IndicatorGroup
                title="EMAILS"
                values={
                  result.indicators
                    .emails
                }
              />

              <IndicatorGroup
                title="HASHES EMBUTIDOS"
                values={
                  result.indicators
                    .hashes
                }
              />
            </div>
          )}

          {activeTab ===
            'strings' && (
            <article className="forensicsStringsPanel">
              <header>
                <div>
                  <span>
                    STRINGS EXTRAÍDAS
                  </span>

                  <strong>
                    {
                      filteredStrings
                        .length
                    }
                  </strong>
                </div>

                <input
                  value={stringFilter}
                  type="search"
                  placeholder="Filtrar strings..."
                  onChange={(event) => {
                    setStringFilter(
                      event.target.value,
                    );
                  }}
                />
              </header>

              <div className="forensicsStringList">
                {filteredStrings.map(
                  (
                    item,
                    index,
                  ) => (
                    <button
                      key={`${item.offset}-${item.encoding}-${index}`}
                      type="button"
                      onClick={() => {
                        window.zeroHub
                          .clipboard
                          .writeText(
                            item.value,
                          );
                      }}
                    >
                      <code>
                        {formatOffset(
                          item.offset,
                        )}
                      </code>

                      <span>
                        {item.encoding}
                      </span>

                      <p>
                        {item.value}
                      </p>
                    </button>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'archive' &&
            result.archive && (
            <article className="forensicsArchivePanel">
              <header>
                <div>
                  <span>CONTEÚDO ZIP</span>

                  <strong>
                    {
                      result.archive
                        .entryCount
                    }
                    {' '}entradas
                  </strong>
                </div>

                <div>
                  <span>
                    Descompactado:
                    {' '}
                    {formatBytes(
                      result.archive
                        .totalUncompressedBytes,
                    )}
                  </span>

                  <span>
                    Criptografadas:
                    {' '}
                    {
                      result.archive
                        .encryptedEntries
                    }
                  </span>
                </div>
              </header>

              {result.archive.error && (
                <div className="toolMessage error">
                  {result.archive.error}
                </div>
              )}

              <div className="forensicsArchiveList">
                {result.archive.entries.map(
                  (
                    entry,
                    index,
                  ) => (
                    <div
                      key={`${entry.name}-${index}`}
                    >
                      <span>
                        {entry.isDirectory
                          ? 'DIR'
                          : 'FILE'}
                      </span>

                      <code>
                        {entry.name}
                      </code>

                      <small>
                        {formatBytes(
                          entry.sizeBytes,
                        )}
                      </small>

                      <small>
                        {entry.encrypted
                          ? 'Encrypted'
                          : entry.crc32}
                      </small>
                    </div>
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
