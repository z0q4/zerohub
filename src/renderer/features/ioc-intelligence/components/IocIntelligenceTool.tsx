import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  IocIntelligenceResult,
  IocKeyInput,
  IocKeyStatus,
  IocProviderName,
} from '../../../../shared/ioc-intelligence/ioc-intelligence.types';

const EMPTY_STATUS:
  IocKeyStatus = {
    encryptionAvailable: false,
    abuseCh: false,
    abuseIpDb: false,
    otx: false,
  };

const EMPTY_KEYS:
  IocKeyInput = {
    abuseCh: '',
    abuseIpDb: '',
    otx: '',
  };

const PROVIDERS: Array<{
  id: IocProviderName;
  name: string;
  key:
    | keyof Omit<
        IocKeyStatus,
        'encryptionAvailable'
      >
    | null;
}> = [
  {
    id: 'urlhaus',
    name: 'URLhaus',
    key: 'abuseCh',
  },
  {
    id: 'malwareBazaar',
    name: 'MalwareBazaar',
    key: 'abuseCh',
  },
  {
    id: 'abuseIpDb',
    name: 'AbuseIPDB',
    key: 'abuseIpDb',
  },
  {
    id: 'otx',
    name: 'OTX',
    key: 'otx',
  },
];

export function IocIntelligenceTool() {
  const [
    indicators,
    setIndicators,
  ] = useState(
    'example.com\n1.1.1.1',
  );

  const [
    services,
    setServices,
  ] = useState<
    Record<
      IocProviderName,
      boolean
    >
  >({
    urlhaus: true,
    malwareBazaar: true,
    abuseIpDb: true,
    otx: true,
  });

  const [
    keyStatus,
    setKeyStatus,
  ] =
    useState<IocKeyStatus>(
      EMPTY_STATUS,
    );

  const [
    keyInput,
    setKeyInput,
  ] =
    useState<IocKeyInput>(
      EMPTY_KEYS,
    );

  const [
    showKeys,
    setShowKeys,
  ] = useState(false);

  const [
    result,
    setResult,
  ] =
    useState<IocIntelligenceResult | null>(
      null,
    );

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const indicatorCount =
    useMemo(
      () =>
        indicators
          .split('\n')
          .map(
            (line) =>
              line.trim(),
          )
          .filter(Boolean)
          .length,
      [indicators],
    );

  async function loadStatus():
    Promise<void> {
    try {
      setKeyStatus(
        await window.zeroHub
          .iocIntelligence
          .keyStatus(),
      );
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível consultar o armazenamento seguro.',
      );
    }
  }

  useEffect(
    () => {
      void loadStatus();
    },
    [],
  );

  async function saveKeys():
    Promise<void> {
    setSaving(true);
    setError(null);

    try {
      setKeyStatus(
        await window.zeroHub
          .iocIntelligence
          .saveKeys(
            keyInput,
          ),
      );

      setKeyInput(
        EMPTY_KEYS,
      );

      setShowKeys(false);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível salvar as chaves.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearKeys():
    Promise<void> {
    setSaving(true);
    setError(null);

    try {
      setKeyStatus(
        await window.zeroHub
          .iocIntelligence
          .clearKeys(),
      );

      setKeyInput(
        EMPTY_KEYS,
      );
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível remover as chaves.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function query():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      setResult(
        await window.zeroHub
          .iocIntelligence
          .query({
            indicators,
            services,
          }),
      );
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'A consulta de inteligência falhou.',
      );
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
            IOC INTELLIGENCE · PYTHON
          </span>

          <h2>Threat Intelligence Hub</h2>

          <p>
            Consulte URLs, domínios, IPs e
            hashes em múltiplos provedores
            sem baixar amostras.
          </p>
        </div>

        <span className="nativeToolBadge">
          Multi-provider
        </span>
      </div>

      <div className="iocNotice">
        Os indicadores selecionados são
        enviados aos provedores externos.
        Chaves são criptografadas pelo
        armazenamento seguro do Electron.
      </div>

      <div className="iocLayout">
        <article className="iocInputPanel">
          <header>
            <span>INDICATORS</span>

            <strong>
              {indicatorCount}/25
            </strong>
          </header>

          <textarea
            value={indicators}
            rows={11}
            spellCheck={false}
            placeholder="Um IOC por linha..."
            onChange={(event) => {
              setIndicators(
                event.target.value,
              );
            }}
          />

          <div className="iocProviderGrid">
            {PROVIDERS.map(
              (provider) => {
                const configured =
                  provider.key === null
                    ? true
                    : keyStatus[
                        provider.key
                      ];

                return (
                  <label
                    key={provider.id}
                  >
                    <input
                      checked={
                        services[
                          provider.id
                        ]
                      }
                      type="checkbox"
                      onChange={(event) => {
                        setServices(
                          (current) => ({
                            ...current,
                            [provider.id]:
                              event.target
                                .checked,
                          }),
                        );
                      }}
                    />

                    <span>
                      {provider.name}
                    </span>

                    <small
                      className={
                        configured
                          ? 'configured'
                          : ''
                      }
                    >
                      {configured
                        ? 'key ok'
                        : 'sem key'}
                    </small>
                  </label>
                );
              },
            )}
          </div>

          <button
            className="primaryButton"
            type="button"
            disabled={
              busy ||
              indicatorCount === 0 ||
              indicatorCount > 25
            }
            onClick={() => {
              void query();
            }}
          >
            {busy
              ? 'Consultando...'
              : 'Consultar IOCs'}
          </button>
        </article>

        <article className="iocKeyPanel">
          <header>
            <span>API KEYS</span>

            <button
              type="button"
              onClick={() => {
                setShowKeys(
                  (current) =>
                    !current,
                );
              }}
            >
              {showKeys
                ? 'Fechar'
                : 'Configurar'}
            </button>
          </header>

          <dl>
            <div>
              <dt>Safe storage</dt>
              <dd>
                {keyStatus
                  .encryptionAvailable
                  ? 'Disponível'
                  : 'Indisponível'}
              </dd>
            </div>

            <div>
              <dt>abuse.ch</dt>
              <dd>
                {keyStatus.abuseCh
                  ? 'Configurada'
                  : 'Ausente'}
              </dd>
            </div>

            <div>
              <dt>AbuseIPDB</dt>
              <dd>
                {keyStatus.abuseIpDb
                  ? 'Configurada'
                  : 'Ausente'}
              </dd>
            </div>

            <div>
              <dt>OTX</dt>
              <dd>
                {keyStatus.otx
                  ? 'Configurada'
                  : 'Ausente'}
              </dd>
            </div>
          </dl>

          {showKeys && (
            <div className="iocKeyForm">
              <label>
                <span>
                  abuse.ch Auth-Key
                </span>

                <input
                  value={
                    keyInput.abuseCh
                  }
                  type="password"
                  autoComplete="off"
                  onChange={(event) => {
                    setKeyInput(
                      (current) => ({
                        ...current,
                        abuseCh:
                          event.target
                            .value,
                      }),
                    );
                  }}
                />
              </label>

              <label>
                <span>
                  AbuseIPDB API key
                </span>

                <input
                  value={
                    keyInput.abuseIpDb
                  }
                  type="password"
                  autoComplete="off"
                  onChange={(event) => {
                    setKeyInput(
                      (current) => ({
                        ...current,
                        abuseIpDb:
                          event.target
                            .value,
                      }),
                    );
                  }}
                />
              </label>

              <label>
                <span>
                  OTX API key
                </span>

                <input
                  value={keyInput.otx}
                  type="password"
                  autoComplete="off"
                  onChange={(event) => {
                    setKeyInput(
                      (current) => ({
                        ...current,
                        otx:
                          event.target
                            .value,
                      }),
                    );
                  }}
                />
              </label>

              <div>
                <button
                  className="primaryButton"
                  type="button"
                  disabled={
                    saving ||
                    !keyStatus
                      .encryptionAvailable
                  }
                  onClick={() => {
                    void saveKeys();
                  }}
                >
                  Salvar chaves
                </button>

                <button
                  className="secondaryButton"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void clearKeys();
                  }}
                >
                  Remover todas
                </button>
              </div>
            </div>
          )}
        </article>
      </div>

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="iocResults">
          <div className="iocStats">
            <article>
              <span>TOTAL</span>
              <strong>
                {result.summary.total}
              </strong>
            </article>

            <article className="danger">
              <span>MALICIOUS</span>
              <strong>
                {
                  result.summary
                    .malicious
                }
              </strong>
            </article>

            <article className="warning">
              <span>SUSPICIOUS</span>
              <strong>
                {
                  result.summary
                    .suspicious
                }
              </strong>
            </article>

            <article>
              <span>ELAPSED</span>
              <strong>
                {result.elapsedMs} ms
              </strong>
            </article>
          </div>

          <div className="iocResultList">
            {result.results.map(
              (item) => (
                <article
                  className={
                    item.risk
                  }
                  key={`${item.index}-${item.indicator}`}
                >
                  <header>
                    <button
                      type="button"
                      onClick={() => {
                        copy(
                          item.indicator,
                        );
                      }}
                    >
                      <code>
                        {item.indicator}
                      </code>
                    </button>

                    <div>
                      <span>
                        {item.type}
                      </span>

                      <strong>
                        {item.risk}
                      </strong>
                    </div>
                  </header>

                  <div className="iocProviderResults">
                    {Object.entries(
                      item.providers,
                    ).map(
                      ([
                        name,
                        provider,
                      ]) => (
                        <details
                          key={name}
                        >
                          <summary>
                            <span>
                              {name}
                            </span>

                            <strong>
                              {
                                provider
                                  .status
                              }
                            </strong>
                          </summary>

                          <p>
                            {provider
                              .summary ??
                              provider
                                .error ??
                              'Sem resumo.'}
                          </p>

                          {provider.data && (
                            <pre>
                              {JSON.stringify(
                                provider.data,
                                null,
                                2,
                              )}
                            </pre>
                          )}
                        </details>
                      ),
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
