import {
  useState,
} from 'react';

import type {
  DiffResult,
  RegexTestResult,
  TimestampConvertResult,
} from '../../../../shared/developer-tools/developer-tools.types';

type DevTab =
  | 'json'
  | 'yaml'
  | 'toml'
  | 'regex'
  | 'uuid'
  | 'timestamp'
  | 'diff';

export function DeveloperToolsTool() {
  const [
    activeTab,
    setActiveTab,
  ] = useState<DevTab>('json');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  const [
    output,
    setOutput,
  ] = useState('');

  const [
    jsonInput,
    setJsonInput,
  ] = useState(
    '{"name":"ZeroHub","modules":["osint","network"]}',
  );

  const [
    jsonIndent,
    setJsonIndent,
  ] = useState(2);

  const [
    sortKeys,
    setSortKeys,
  ] = useState(false);

  const [
    yamlInput,
    setYamlInput,
  ] = useState(
    'name: ZeroHub\nmodules:\n  - osint\n  - network',
  );

  const [
    yamlDirection,
    setYamlDirection,
  ] = useState(
    'yaml-to-json',
  );

  const [
    tomlInput,
    setTomlInput,
  ] = useState(
    'name = "ZeroHub"\nversion = "0.1.0"\n',
  );

  const [
    tomlDirection,
    setTomlDirection,
  ] = useState(
    'toml-to-json',
  );

  const [
    regexPattern,
    setRegexPattern,
  ] = useState(
    String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
  );

  const [
    regexText,
    setRegexText,
  ] = useState(
    'Contato: user@example.com',
  );

  const [
    regexFlags,
    setRegexFlags,
  ] = useState('i');

  const [
    regexReplacement,
    setRegexReplacement,
  ] = useState('');

  const [
    regexResult,
    setRegexResult,
  ] =
    useState<RegexTestResult | null>(
      null,
    );

  const [
    uuidVersion,
    setUuidVersion,
  ] = useState('4');

  const [
    uuidCount,
    setUuidCount,
  ] = useState(5);

  const [
    uuidNamespace,
    setUuidNamespace,
  ] = useState('dns');

  const [
    uuidName,
    setUuidName,
  ] = useState(
    'zerohub.local',
  );

  const [
    timestampInput,
    setTimestampInput,
  ] = useState('');

  const [
    timestampResult,
    setTimestampResult,
  ] =
    useState<TimestampConvertResult | null>(
      null,
    );

  const [
    diffLeft,
    setDiffLeft,
  ] = useState(
    'const version = 1;\nconsole.log(version);',
  );

  const [
    diffRight,
    setDiffRight,
  ] = useState(
    'const version = 2;\nconsole.log("ZeroHub", version);',
  );

  const [
    diffResult,
    setDiffResult,
  ] =
    useState<DiffResult | null>(
      null,
    );

  function start(): void {
    setBusy(true);
    setError(null);
  }

  function fail(
    unknownError: unknown,
  ): void {
    setError(
      unknownError instanceof Error
        ? unknownError.message
        : 'A operação falhou.',
    );
  }

  function copy(
    value: string,
  ): void {
    window.zeroHub
      .clipboard
      .writeText(value);
  }

  async function formatJson(
    minify: boolean,
  ): Promise<void> {
    start();

    try {
      const result =
        await window.zeroHub
          .developerTools
          .formatJson({
            text: jsonInput,
            indent: jsonIndent,
            sortKeys,
            minify,
          });

      setOutput(result.output);
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function convertYaml():
    Promise<void> {
    start();

    try {
      const result =
        await window.zeroHub
          .developerTools
          .convertYaml(
            yamlInput,
            yamlDirection,
          );

      setOutput(result.output);
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function convertToml():
    Promise<void> {
    start();

    try {
      const result =
        await window.zeroHub
          .developerTools
          .convertToml(
            tomlInput,
            tomlDirection,
          );

      setOutput(result.output);
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function testRegex():
    Promise<void> {
    start();

    try {
      const result =
        await window.zeroHub
          .developerTools
          .testRegex({
            pattern: regexPattern,
            text: regexText,
            flags: regexFlags,
            replacement:
              regexReplacement,
          });

      setRegexResult(result);
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function generateUuid():
    Promise<void> {
    start();

    try {
      const result =
        await window.zeroHub
          .developerTools
          .generateUuid({
            version: uuidVersion,
            count: uuidCount,
            namespace:
              uuidNamespace,

            name: uuidName,
          });

      setOutput(
        result.values.join('\n'),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function convertTimestamp():
    Promise<void> {
    start();

    try {
      setTimestampResult(
        await window.zeroHub
          .developerTools
          .convertTimestamp(
            timestampInput,
          ),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function compareDiff():
    Promise<void> {
    start();

    try {
      setDiffResult(
        await window.zeroHub
          .developerTools
          .diff({
            left: diffLeft,
            right: diffRight,
            leftLabel: 'before',
            rightLabel: 'after',
          }),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            DEVELOPER TOOLS · PYTHON
          </span>

          <h2>Developer Utility Suite</h2>

          <p>
            Formatação, conversão,
            expressões regulares,
            identificadores, datas e diff.
          </p>
        </div>

        <span className="nativeToolBadge">
          Local Processing
        </span>
      </div>

      <div className="developerToolsTabs">
        {(
          [
            ['json', 'JSON'],
            ['yaml', 'YAML'],
            ['toml', 'TOML'],
            ['regex', 'Regex'],
            ['uuid', 'UUID'],
            [
              'timestamp',
              'Timestamp',
            ],
            ['diff', 'Diff'],
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
                setError(null);
                setOutput('');
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}

      {activeTab === 'json' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>JSON INPUT</span>
            </header>

            <textarea
              value={jsonInput}
              rows={18}
              spellCheck={false}
              onChange={(event) => {
                setJsonInput(
                  event.target.value,
                );
              }}
            />

            <div className="developerInline">
              <label>
                <span>Indentação</span>

                <select
                  value={jsonIndent}
                  onChange={(event) => {
                    setJsonIndent(
                      Number(
                        event.target.value,
                      ),
                    );
                  }}
                >
                  <option value={2}>
                    2 espaços
                  </option>

                  <option value={4}>
                    4 espaços
                  </option>
                </select>
              </label>

              <label className="developerCheck">
                <input
                  checked={sortKeys}
                  type="checkbox"
                  onChange={(event) => {
                    setSortKeys(
                      event.target.checked,
                    );
                  }}
                />

                <span>Ordenar chaves</span>
              </label>
            </div>

            <div className="developerActions">
              <button
                className="primaryButton"
                type="button"
                disabled={busy}
                onClick={() => {
                  void formatJson(false);
                }}
              >
                Formatar
              </button>

              <button
                className="secondaryButton"
                type="button"
                disabled={busy}
                onClick={() => {
                  void formatJson(true);
                }}
              >
                Minificar
              </button>
            </div>
          </article>

          <article className="developerPanel">
            <header>
              <span>OUTPUT</span>

              <button
                type="button"
                disabled={!output}
                onClick={() => {
                  copy(output);
                }}
              >
                Copiar
              </button>
            </header>

            <pre>{output}</pre>
          </article>
        </div>
      )}

      {activeTab === 'yaml' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>YAML / JSON</span>
            </header>

            <select
              value={yamlDirection}
              onChange={(event) => {
                setYamlDirection(
                  event.target.value,
                );
              }}
            >
              <option value="yaml-to-json">
                YAML → JSON
              </option>

              <option value="json-to-yaml">
                JSON → YAML
              </option>
            </select>

            <textarea
              value={yamlInput}
              rows={20}
              spellCheck={false}
              onChange={(event) => {
                setYamlInput(
                  event.target.value,
                );
              }}
            />

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void convertYaml();
              }}
            >
              Converter
            </button>

            <p className="developerNotice">
              Suporta o subconjunto comum de
              YAML. Anchors, tags e blocos
              multilinha não são processados.
            </p>
          </article>

          <article className="developerPanel">
            <header>
              <span>OUTPUT</span>

              <button
                type="button"
                disabled={!output}
                onClick={() => {
                  copy(output);
                }}
              >
                Copiar
              </button>
            </header>

            <pre>{output}</pre>
          </article>
        </div>
      )}

      {activeTab === 'toml' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>TOML / JSON</span>
            </header>

            <select
              value={tomlDirection}
              onChange={(event) => {
                setTomlDirection(
                  event.target.value,
                );
              }}
            >
              <option value="toml-to-json">
                TOML → JSON
              </option>

              <option value="json-to-toml">
                JSON → TOML
              </option>
            </select>

            <textarea
              value={tomlInput}
              rows={20}
              spellCheck={false}
              onChange={(event) => {
                setTomlInput(
                  event.target.value,
                );
              }}
            />

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void convertToml();
              }}
            >
              Converter
            </button>
          </article>

          <article className="developerPanel">
            <header>
              <span>OUTPUT</span>

              <button
                type="button"
                disabled={!output}
                onClick={() => {
                  copy(output);
                }}
              >
                Copiar
              </button>
            </header>

            <pre>{output}</pre>
          </article>
        </div>
      )}

      {activeTab === 'regex' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>REGEX TESTER</span>
            </header>

            <label>
              <span>Expressão</span>

              <input
                value={regexPattern}
                type="text"
                spellCheck={false}
                onChange={(event) => {
                  setRegexPattern(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>
                Flags
                {' '}
                (i, m, s, x, a)
              </span>

              <input
                value={regexFlags}
                type="text"
                spellCheck={false}
                onChange={(event) => {
                  setRegexFlags(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Texto</span>

              <textarea
                value={regexText}
                rows={11}
                onChange={(event) => {
                  setRegexText(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>
                Substituição
                {' '}
                (opcional)
              </span>

              <input
                value={
                  regexReplacement
                }
                type="text"
                onChange={(event) => {
                  setRegexReplacement(
                    event.target.value,
                  );
                }}
              />
            </label>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void testRegex();
              }}
            >
              Executar regex
            </button>
          </article>

          <article className="developerPanel">
            <header>
              <span>RESULTADO</span>

              <strong>
                {regexResult
                  ? `${regexResult.matchCount} matches`
                  : ''}
              </strong>
            </header>

            <pre>
              {regexResult
                ? JSON.stringify(
                    regexResult,
                    null,
                    2,
                  )
                : ''}
            </pre>
          </article>
        </div>
      )}

      {activeTab === 'uuid' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>UUID GENERATOR</span>
            </header>

            <div className="developerInline">
              <label>
                <span>Versão</span>

                <select
                  value={uuidVersion}
                  onChange={(event) => {
                    setUuidVersion(
                      event.target.value,
                    );
                  }}
                >
                  <option value="4">
                    UUID v4
                  </option>

                  <option value="5">
                    UUID v5
                  </option>
                </select>
              </label>

              <label>
                <span>Quantidade</span>

                <input
                  value={uuidCount}
                  type="number"
                  min={1}
                  max={200}
                  onChange={(event) => {
                    setUuidCount(
                      Number(
                        event.target.value,
                      ),
                    );
                  }}
                />
              </label>
            </div>

            {uuidVersion === '5' && (
              <>
                <label>
                  <span>Namespace</span>

                  <select
                    value={uuidNamespace}
                    onChange={(event) => {
                      setUuidNamespace(
                        event.target.value,
                      );
                    }}
                  >
                    <option value="dns">
                      DNS
                    </option>

                    <option value="url">
                      URL
                    </option>

                    <option value="oid">
                      OID
                    </option>

                    <option value="x500">
                      X.500
                    </option>
                  </select>
                </label>

                <label>
                  <span>Nome</span>

                  <input
                    value={uuidName}
                    type="text"
                    onChange={(event) => {
                      setUuidName(
                        event.target.value,
                      );
                    }}
                  />
                </label>
              </>
            )}

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void generateUuid();
              }}
            >
              Gerar UUID
            </button>
          </article>

          <article className="developerPanel">
            <header>
              <span>OUTPUT</span>

              <button
                type="button"
                disabled={!output}
                onClick={() => {
                  copy(output);
                }}
              >
                Copiar tudo
              </button>
            </header>

            <pre>{output}</pre>
          </article>
        </div>
      )}

      {activeTab ===
        'timestamp' && (
        <div className="developerWorkspace">
          <article className="developerPanel">
            <header>
              <span>TIMESTAMP CONVERTER</span>
            </header>

            <label>
              <span>
                Unix seconds, milliseconds
                ou ISO 8601
              </span>

              <input
                value={timestampInput}
                type="text"
                placeholder="Vazio = agora"
                onChange={(event) => {
                  setTimestampInput(
                    event.target.value,
                  );
                }}
              />
            </label>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void convertTimestamp();
              }}
            >
              Converter
            </button>
          </article>

          <article className="developerPanel">
            <header>
              <span>RESULTADO</span>
            </header>

            <pre>
              {timestampResult
                ? JSON.stringify(
                    timestampResult,
                    null,
                    2,
                  )
                : ''}
            </pre>
          </article>
        </div>
      )}

      {activeTab === 'diff' && (
        <div className="developerDiffWorkspace">
          <article className="developerPanel">
            <header>
              <span>BEFORE</span>
            </header>

            <textarea
              value={diffLeft}
              rows={18}
              spellCheck={false}
              onChange={(event) => {
                setDiffLeft(
                  event.target.value,
                );
              }}
            />
          </article>

          <article className="developerPanel">
            <header>
              <span>AFTER</span>
            </header>

            <textarea
              value={diffRight}
              rows={18}
              spellCheck={false}
              onChange={(event) => {
                setDiffRight(
                  event.target.value,
                );
              }}
            />
          </article>

          <button
            className="primaryButton developerDiffButton"
            type="button"
            disabled={busy}
            onClick={() => {
              void compareDiff();
            }}
          >
            Comparar
          </button>

          <article className="developerPanel developerDiffResult">
            <header>
              <span>UNIFIED DIFF</span>

              <strong>
                {diffResult
                  ? `${diffResult.similarity}% similar`
                  : ''}
              </strong>
            </header>

            <pre>
              {diffResult?.unifiedDiff ??
                ''}
            </pre>
          </article>
        </div>
      )}
    </section>
  );
}
