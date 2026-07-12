import {
  useState,
} from 'react';

import type {
  CompareResult,
  CryptoAlgorithm,
  CryptoEncoding,
  HmacResult,
  HmacVerifyResult,
  JwtResult,
  Pbkdf2Result,
  RandomFormat,
  RandomResult,
} from '../../../../shared/cryptography/cryptography.types';

type Tab =
  | 'hmac'
  | 'pbkdf2'
  | 'random'
  | 'jwt'
  | 'compare';

function JsonOutput({
  value,
}: {
  value: unknown;
}) {
  return (
    <pre className="cryptoOutput">
      {JSON.stringify(
        value,
        null,
        2,
      )}
    </pre>
  );
}

export function CryptographyTool() {
  const [
    tab,
    setTab,
  ] = useState<Tab>('hmac');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    key,
    setKey,
  ] = useState('');

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    expected,
    setExpected,
  ] = useState('');

  const [
    algorithm,
    setAlgorithm,
  ] =
    useState<CryptoAlgorithm>(
      'sha256',
    );

  const [
    encoding,
    setEncoding,
  ] =
    useState<CryptoEncoding>(
      'hex',
    );

  const [
    hmacResult,
    setHmacResult,
  ] =
    useState<
      HmacResult |
      HmacVerifyResult |
      null
    >(null);

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    salt,
    setSalt,
  ] = useState('');

  const [
    iterations,
    setIterations,
  ] = useState(210000);

  const [
    derivedLength,
    setDerivedLength,
  ] = useState(32);

  const [
    pbkdf2Result,
    setPbkdf2Result,
  ] =
    useState<Pbkdf2Result | null>(
      null,
    );

  const [
    randomFormat,
    setRandomFormat,
  ] =
    useState<RandomFormat>(
      'password',
    );

  const [
    randomLength,
    setRandomLength,
  ] = useState(24);

  const [
    randomResult,
    setRandomResult,
  ] =
    useState<RandomResult | null>(
      null,
    );

  const [
    jwt,
    setJwt,
  ] = useState('');

  const [
    jwtResult,
    setJwtResult,
  ] =
    useState<JwtResult | null>(
      null,
    );

  const [
    left,
    setLeft,
  ] = useState('');

  const [
    right,
    setRight,
  ] = useState('');

  const [
    compareResult,
    setCompareResult,
  ] =
    useState<CompareResult | null>(
      null,
    );

  function fail(
    unknownError: unknown,
  ): void {
    setError(
      unknownError instanceof Error
        ? unknownError.message
        : 'A operação falhou.',
    );
  }

  async function run(
    action: () => Promise<void>,
  ): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  function copy(
    value: string,
  ): void {
    window.zeroHub
      .clipboard
      .writeText(value);
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            CRYPTOGRAPHY · PYTHON
          </span>

          <h2>Cryptographic Toolkit</h2>

          <p>
            HMAC, PBKDF2, geração segura,
            JWT e comparação em tempo
            constante.
          </p>
        </div>

        <span className="nativeToolBadge">
          Local Only
        </span>
      </div>

      <div className="cryptoTabs">
        {(
          [
            ['hmac', 'HMAC'],
            ['pbkdf2', 'PBKDF2'],
            ['random', 'Gerador'],
            ['jwt', 'JWT'],
            ['compare', 'Comparar'],
          ] as const
        ).map(
          ([id, label]) => (
            <button
              className={
                tab === id
                  ? 'active'
                  : ''
              }
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {error && (
        <div className="toolMessage error">
          {error}
        </div>
      )}

      {tab === 'hmac' && (
        <div className="cryptoGrid">
          <article className="cryptoCard">
            <header>CRIAR / VERIFICAR HMAC</header>

            <label>
              <span>Chave</span>

              <input
                value={key}
                type="password"
                onChange={(event) =>
                  setKey(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>Mensagem</span>

              <textarea
                value={message}
                rows={7}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="cryptoFields">
              <select
                value={algorithm}
                onChange={(event) =>
                  setAlgorithm(
                    event.target
                      .value as CryptoAlgorithm,
                  )
                }
              >
                <option value="sha256">
                  SHA-256
                </option>

                <option value="sha512">
                  SHA-512
                </option>
              </select>

              <select
                value={encoding}
                onChange={(event) =>
                  setEncoding(
                    event.target
                      .value as CryptoEncoding,
                  )
                }
              >
                <option value="hex">
                  Hex
                </option>

                <option value="base64">
                  Base64
                </option>
              </select>
            </div>

            <button
              className="primaryButton"
              disabled={busy}
              type="button"
              onClick={() => {
                void run(async () => {
                  setHmacResult(
                    await window.zeroHub
                      .cryptography
                      .createHmac({
                        key,
                        message,
                        algorithm,
                        encoding,
                      }),
                  );
                });
              }}
            >
              Criar HMAC
            </button>

            <label>
              <span>HMAC esperado</span>

              <textarea
                value={expected}
                rows={3}
                onChange={(event) =>
                  setExpected(
                    event.target.value,
                  )
                }
              />
            </label>

            <button
              className="secondaryButton"
              disabled={
                busy ||
                !expected.trim()
              }
              type="button"
              onClick={() => {
                void run(async () => {
                  setHmacResult(
                    await window.zeroHub
                      .cryptography
                      .verifyHmac({
                        key,
                        message,
                        expected,
                        algorithm,
                        encoding,
                      }),
                  );
                });
              }}
            >
              Verificar
            </button>
          </article>

          <article className="cryptoCard">
            <header>RESULTADO</header>

            {hmacResult ? (
              <>
                <JsonOutput
                  value={hmacResult}
                />

                {'digest' in hmacResult && (
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() =>
                      copy(
                        hmacResult.digest,
                      )
                    }
                  >
                    Copiar digest
                  </button>
                )}
              </>
            ) : (
              <p>
                Nenhum resultado.
              </p>
            )}
          </article>
        </div>
      )}

      {tab === 'pbkdf2' && (
        <div className="cryptoGrid">
          <article className="cryptoCard">
            <header>PBKDF2</header>

            <label>
              <span>Senha</span>

              <input
                value={password}
                type="password"
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Salt UTF-8
                {' '}
                (vazio = gerar)
              </span>

              <input
                value={salt}
                onChange={(event) =>
                  setSalt(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="cryptoFields triple">
              <select
                value={algorithm}
                onChange={(event) =>
                  setAlgorithm(
                    event.target
                      .value as CryptoAlgorithm,
                  )
                }
              >
                <option value="sha256">
                  SHA-256
                </option>

                <option value="sha512">
                  SHA-512
                </option>
              </select>

              <input
                value={iterations}
                type="number"
                min={1000}
                max={2000000}
                onChange={(event) =>
                  setIterations(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />

              <input
                value={derivedLength}
                type="number"
                min={16}
                max={128}
                onChange={(event) =>
                  setDerivedLength(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
            </div>

            <button
              className="primaryButton"
              disabled={busy}
              type="button"
              onClick={() => {
                void run(async () => {
                  setPbkdf2Result(
                    await window.zeroHub
                      .cryptography
                      .derivePbkdf2({
                        password,
                        salt,
                        algorithm,
                        iterations,
                        length:
                          derivedLength,
                      }),
                  );
                });
              }}
            >
              Derivar chave
            </button>
          </article>

          <article className="cryptoCard">
            <header>RESULTADO</header>

            {pbkdf2Result ? (
              <>
                <JsonOutput
                  value={pbkdf2Result}
                />

                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() =>
                    copy(
                      pbkdf2Result
                        .derivedKeyHex,
                    )
                  }
                >
                  Copiar chave
                </button>
              </>
            ) : (
              <p>
                Nenhuma chave derivada.
              </p>
            )}
          </article>
        </div>
      )}

      {tab === 'random' && (
        <div className="cryptoGrid">
          <article className="cryptoCard">
            <header>GERADOR SEGURO</header>

            <div className="cryptoFields">
              <select
                value={randomFormat}
                onChange={(event) => {
                  const next =
                    event.target
                      .value as RandomFormat;

                  setRandomFormat(next);

                  setRandomLength(
                    next === 'password'
                      ? 24
                      : 32,
                  );
                }}
              >
                <option value="password">
                  Senha
                </option>

                <option value="hex">
                  Hex
                </option>

                <option value="base64url">
                  Base64URL
                </option>
              </select>

              <input
                value={randomLength}
                type="number"
                min={1}
                max={
                  randomFormat ===
                  'password'
                    ? 256
                    : 4096
                }
                onChange={(event) =>
                  setRandomLength(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
            </div>

            <button
              className="primaryButton"
              disabled={busy}
              type="button"
              onClick={() => {
                void run(async () => {
                  setRandomResult(
                    await window.zeroHub
                      .cryptography
                      .generateRandom({
                        format:
                          randomFormat,

                        length:
                          randomLength,

                        lower: true,
                        upper: true,
                        digits: true,
                        symbols: true,
                      }),
                  );
                });
              }}
            >
              Gerar
            </button>
          </article>

          <article className="cryptoCard">
            <header>RESULTADO</header>

            {randomResult ? (
              <>
                <textarea
                  value={
                    randomResult.value
                  }
                  rows={10}
                  readOnly
                />

                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() =>
                    copy(
                      randomResult.value,
                    )
                  }
                >
                  Copiar
                </button>
              </>
            ) : (
              <p>
                Nenhum valor gerado.
              </p>
            )}
          </article>
        </div>
      )}

      {tab === 'jwt' && (
        <div className="cryptoGrid">
          <article className="cryptoCard">
            <header>JWT INSPECTOR</header>

            <textarea
              value={jwt}
              rows={14}
              placeholder="eyJhbGciOi..."
              onChange={(event) =>
                setJwt(
                  event.target.value,
                )
              }
            />

            <button
              className="primaryButton"
              disabled={
                busy ||
                !jwt.trim()
              }
              type="button"
              onClick={() => {
                void run(async () => {
                  setJwtResult(
                    await window.zeroHub
                      .cryptography
                      .decodeJwt(jwt),
                  );
                });
              }}
            >
              Decodificar
            </button>

            <div className="cryptoWarning">
              Apenas decodifica. Não verifica
              a assinatura.
            </div>
          </article>

          <article className="cryptoCard">
            <header>RESULTADO</header>

            {jwtResult ? (
              <JsonOutput
                value={jwtResult}
              />
            ) : (
              <p>
                Nenhum JWT decodificado.
              </p>
            )}
          </article>
        </div>
      )}

      {tab === 'compare' && (
        <div className="cryptoGrid">
          <article className="cryptoCard">
            <header>COMPARAÇÃO CONSTANTE</header>

            <textarea
              value={left}
              rows={7}
              placeholder="Primeiro valor"
              onChange={(event) =>
                setLeft(
                  event.target.value,
                )
              }
            />

            <textarea
              value={right}
              rows={7}
              placeholder="Segundo valor"
              onChange={(event) =>
                setRight(
                  event.target.value,
                )
              }
            />

            <button
              className="primaryButton"
              disabled={busy}
              type="button"
              onClick={() => {
                void run(async () => {
                  setCompareResult(
                    await window.zeroHub
                      .cryptography
                      .compare(
                        left,
                        right,
                      ),
                  );
                });
              }}
            >
              Comparar
            </button>
          </article>

          <article className="cryptoCard">
            <header>RESULTADO</header>

            {compareResult ? (
              <div
                className={`cryptoCompare ${
                  compareResult.equal
                    ? 'equal'
                    : 'different'
                }`}
              >
                <strong>
                  {compareResult.equal
                    ? 'Valores iguais'
                    : 'Valores diferentes'}
                </strong>

                <span>
                  {
                    compareResult
                      .leftLength
                  }
                  {' / '}
                  {
                    compareResult
                      .rightLength
                  }
                  {' caracteres'}
                </span>
              </div>
            ) : (
              <p>
                Nenhuma comparação.
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
