import {
  useState,
} from 'react';

import type {
  DnsExploreResult,
  NetworkInterfacesResult,
  NetworkRoutesResult,
  PortCheckResult,
  SubnetResult,
  TracerouteResult,
} from '../../../../shared/network-toolkit/network-toolkit.types';

type NetworkTab =
  | 'port'
  | 'traceroute'
  | 'subnet'
  | 'dns'
  | 'interfaces'
  | 'routes';

function JsonResult({
  value,
}: {
  value: unknown;
}) {
  return (
    <pre className="networkToolkitJson">
      {JSON.stringify(
        value,
        null,
        2,
      )}
    </pre>
  );
}

export function NetworkToolkitTool() {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<NetworkTab>(
      'port',
    );

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
    host,
    setHost,
  ] = useState(
    'example.com',
  );

  const [
    port,
    setPort,
  ] = useState(443);

  const [
    timeoutMs,
    setTimeoutMs,
  ] = useState(3000);

  const [
    portResult,
    setPortResult,
  ] =
    useState<PortCheckResult | null>(
      null,
    );

  const [
    traceHost,
    setTraceHost,
  ] = useState(
    '1.1.1.1',
  );

  const [
    maxHops,
    setMaxHops,
  ] = useState(20);

  const [
    traceResult,
    setTraceResult,
  ] =
    useState<TracerouteResult | null>(
      null,
    );

  const [
    cidr,
    setCidr,
  ] = useState(
    '192.168.1.10/24',
  );

  const [
    subnetResult,
    setSubnetResult,
  ] =
    useState<SubnetResult | null>(
      null,
    );

  const [
    dnsDomain,
    setDnsDomain,
  ] = useState(
    'example.com',
  );

  const [
    dnsType,
    setDnsType,
  ] = useState<
    'A' |
    'AAAA' |
    'CNAME' |
    'MX' |
    'TXT'
  >('A');

  const [
    dnsResult,
    setDnsResult,
  ] =
    useState<DnsExploreResult | null>(
      null,
    );

  const [
    interfacesResult,
    setInterfacesResult,
  ] =
    useState<NetworkInterfacesResult | null>(
      null,
    );

  const [
    routesResult,
    setRoutesResult,
  ] =
    useState<NetworkRoutesResult | null>(
      null,
    );

  function begin(): void {
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

  async function checkPort():
    Promise<void> {
    begin();

    try {
      setPortResult(
        await window.zeroHub
          .networkToolkit
          .checkPort({
            host,
            port,
            timeoutMs,
          }),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function runTraceroute():
    Promise<void> {
    begin();

    try {
      setTraceResult(
        await window.zeroHub
          .networkToolkit
          .traceroute({
            host: traceHost,
            maxHops,
          }),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function calculateSubnet():
    Promise<void> {
    begin();

    try {
      setSubnetResult(
        await window.zeroHub
          .networkToolkit
          .calculateSubnet(
            cidr,
          ),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function lookupDns():
    Promise<void> {
    begin();

    try {
      setDnsResult(
        await window.zeroHub
          .networkToolkit
          .dnsLookup(
            dnsDomain,
            dnsType,
          ),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function loadInterfaces():
    Promise<void> {
    begin();

    try {
      setInterfacesResult(
        await window.zeroHub
          .networkToolkit
          .listInterfaces(),
      );
    } catch (unknownError) {
      fail(unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function loadRoutes():
    Promise<void> {
    begin();

    try {
      setRoutesResult(
        await window.zeroHub
          .networkToolkit
          .listRoutes(),
      );
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
            NETWORK TOOLKIT · PYTHON
          </span>

          <h2>Advanced Network Utilities</h2>

          <p>
            Teste uma porta, trace rotas,
            calcule sub-redes, consulte DNS
            e inspecione a rede local.
          </p>
        </div>

        <span className="nativeToolBadge">
          Single Target
        </span>
      </div>

      <div className="networkToolkitTabs">
        {(
          [
            ['port', 'Port Check'],
            ['traceroute', 'Traceroute'],
            ['subnet', 'Subnet'],
            ['dns', 'DNS'],
            ['interfaces', 'Interfaces'],
            ['routes', 'Routes'],
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

      {activeTab === 'port' && (
        <div className="networkToolkitWorkspace">
          <article className="networkToolkitForm">
            <header>
              <span>TCP PORT CHECK</span>
            </header>

            <label>
              <span>Host</span>

              <input
                value={host}
                type="text"
                spellCheck={false}
                onChange={(event) => {
                  setHost(
                    event.target.value,
                  );
                }}
              />
            </label>

            <div className="networkToolkitInline">
              <label>
                <span>Porta</span>

                <input
                  value={port}
                  type="number"
                  min={1}
                  max={65535}
                  onChange={(event) => {
                    setPort(
                      Number(
                        event.target.value,
                      ),
                    );
                  }}
                />
              </label>

              <label>
                <span>Timeout (ms)</span>

                <input
                  value={timeoutMs}
                  type="number"
                  min={100}
                  max={30000}
                  onChange={(event) => {
                    setTimeoutMs(
                      Number(
                        event.target.value,
                      ),
                    );
                  }}
                />
              </label>
            </div>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void checkPort();
              }}
            >
              Verificar porta
            </button>
          </article>

          <article className="networkToolkitResult">
            <header>
              <span>RESULTADO</span>
            </header>

            {portResult ? (
              <>
                <div
                  className={`networkPortState ${
                    portResult.open
                      ? 'open'
                      : 'closed'
                  }`}
                >
                  <strong>
                    {portResult.open
                      ? 'Porta aberta'
                      : 'Porta fechada ou inacessível'}
                  </strong>

                  <span>
                    {portResult.host}
                    :
                    {portResult.port}
                  </span>
                </div>

                <JsonResult
                  value={portResult}
                />
              </>
            ) : (
              <p>
                Nenhuma porta verificada.
              </p>
            )}
          </article>
        </div>
      )}

      {activeTab ===
        'traceroute' && (
        <div className="networkToolkitWorkspace">
          <article className="networkToolkitForm">
            <header>
              <span>TRACEROUTE</span>
            </header>

            <label>
              <span>Host</span>

              <input
                value={traceHost}
                type="text"
                spellCheck={false}
                onChange={(event) => {
                  setTraceHost(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Máximo de saltos</span>

              <input
                value={maxHops}
                type="number"
                min={1}
                max={64}
                onChange={(event) => {
                  setMaxHops(
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
                void runTraceroute();
              }}
            >
              Traçar rota
            </button>
          </article>

          <article className="networkToolkitResult">
            <header>
              <span>HOPS</span>

              <strong>
                {traceResult?.hops.length ??
                  0}
              </strong>
            </header>

            {traceResult ? (
              <>
                <div className="networkHopList">
                  {traceResult.hops.map(
                    (hop) => (
                      <button
                        key={hop.hop}
                        type="button"
                        onClick={() => {
                          copy(hop.raw);
                        }}
                      >
                        <strong>
                          {hop.hop}
                        </strong>

                        <code>
                          {hop.addresses.join(
                            ', ',
                          ) ||
                            '*'}
                        </code>

                        <span>
                          {hop.rttsMs
                            .map(
                              (rtt) =>
                                `${rtt} ms`,
                            )
                            .join(', ') ||
                            'timeout'}
                        </span>
                      </button>
                    ),
                  )}
                </div>

                <pre className="networkToolkitJson">
                  {traceResult.rawOutput}
                </pre>
              </>
            ) : (
              <p>
                Nenhuma rota traçada.
              </p>
            )}
          </article>
        </div>
      )}

      {activeTab === 'subnet' && (
        <div className="networkToolkitWorkspace">
          <article className="networkToolkitForm">
            <header>
              <span>SUBNET CALCULATOR</span>
            </header>

            <label>
              <span>IP / CIDR</span>

              <input
                value={cidr}
                type="text"
                spellCheck={false}
                placeholder="192.168.1.10/24"
                onChange={(event) => {
                  setCidr(
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
                void calculateSubnet();
              }}
            >
              Calcular
            </button>
          </article>

          <article className="networkToolkitResult">
            <header>
              <span>RESULTADO</span>
            </header>

            {subnetResult ? (
              <dl className="networkToolkitDetails">
                {Object.entries(
                  subnetResult,
                ).map(
                  ([
                    key,
                    value,
                  ]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>
                        {String(value)}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            ) : (
              <p>
                Nenhuma sub-rede calculada.
              </p>
            )}
          </article>
        </div>
      )}

      {activeTab === 'dns' && (
        <div className="networkToolkitWorkspace">
          <article className="networkToolkitForm">
            <header>
              <span>DNS EXPLORER</span>
            </header>

            <label>
              <span>Domínio</span>

              <input
                value={dnsDomain}
                type="text"
                spellCheck={false}
                onChange={(event) => {
                  setDnsDomain(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label>
              <span>Tipo</span>

              <select
                value={dnsType}
                onChange={(event) => {
                  setDnsType(
                    event.target.value as
                      | 'A'
                      | 'AAAA'
                      | 'CNAME'
                      | 'MX'
                      | 'TXT',
                  );
                }}
              >
                <option value="A">A</option>
                <option value="AAAA">
                  AAAA
                </option>
                <option value="CNAME">
                  CNAME
                </option>
                <option value="MX">MX</option>
                <option value="TXT">
                  TXT
                </option>
              </select>
            </label>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void lookupDns();
              }}
            >
              Consultar
            </button>
          </article>

          <article className="networkToolkitResult">
            <header>
              <span>DNS RECORDS</span>

              <strong>
                {dnsResult?.records.length ??
                  0}
              </strong>
            </header>

            {dnsResult ? (
              <div className="networkDnsList">
                {dnsResult.records.map(
                  (
                    record,
                    index,
                  ) => {
                    const value =
                      typeof record.value ===
                      'string'
                        ? record.value
                        : `${record.value.preference} ${record.value.exchange}`;

                    return (
                      <button
                        key={`${record.name}-${record.type}-${index}`}
                        type="button"
                        onClick={() => {
                          copy(value);
                        }}
                      >
                        <code>
                          {record.name}
                        </code>

                        <span>
                          {value}
                        </span>

                        <small>
                          TTL {record.ttl}
                        </small>
                      </button>
                    );
                  },
                )}
              </div>
            ) : (
              <p>
                Nenhuma consulta executada.
              </p>
            )}
          </article>
        </div>
      )}

      {activeTab ===
        'interfaces' && (
        <div className="networkToolkitSingle">
          <div className="networkToolkitActionBar">
            <span>
              Interfaces locais via
              {' '}
              <code>ip -json address</code>
            </span>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void loadInterfaces();
              }}
            >
              Carregar interfaces
            </button>
          </div>

          {interfacesResult ? (
            <div className="networkInterfaceGrid">
              {interfacesResult.interfaces.map(
                (
                  item,
                  index,
                ) => (
                  <article
                    key={`${item.name}-${index}`}
                  >
                    <header>
                      <strong>
                        {item.name ??
                          'unknown'}
                      </strong>

                      <span>
                        {item.state ??
                          'unknown'}
                      </span>
                    </header>

                    <dl>
                      <div>
                        <dt>MAC</dt>
                        <dd>
                          {item.mac ?? '—'}
                        </dd>
                      </div>

                      <div>
                        <dt>MTU</dt>
                        <dd>
                          {item.mtu ?? '—'}
                        </dd>
                      </div>
                    </dl>

                    <div>
                      {item.addresses.map(
                        (
                          address,
                          addressIndex,
                        ) => (
                          <button
                            key={`${address.local}-${addressIndex}`}
                            type="button"
                            onClick={() => {
                              copy(
                                `${address.local}/${address.prefixLength}`,
                              );
                            }}
                          >
                            <code>
                              {address.local}
                              /
                              {
                                address.prefixLength
                              }
                            </code>

                            <span>
                              {address.family}
                              {' · '}
                              {address.scope}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <p className="networkToolkitPlaceholder">
              Carregue as interfaces para
              visualizar os endereços locais.
            </p>
          )}
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="networkToolkitSingle">
          <div className="networkToolkitActionBar">
            <span>
              Tabela de roteamento local
            </span>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void loadRoutes();
              }}
            >
              Carregar rotas
            </button>
          </div>

          {routesResult ? (
            <div className="networkRouteTable">
              <div className="networkRouteHeader">
                <span>DESTINO</span>
                <span>GATEWAY</span>
                <span>INTERFACE</span>
                <span>PROTOCOLO</span>
                <span>MÉTRICA</span>
              </div>

              {routesResult.routes.map(
                (
                  route,
                  index,
                ) => (
                  <button
                    key={`${route.destination}-${route.gateway}-${index}`}
                    type="button"
                    onClick={() => {
                      copy(
                        JSON.stringify(
                          route,
                        ),
                      );
                    }}
                  >
                    <code>
                      {route.destination}
                    </code>

                    <span>
                      {route.gateway ?? '—'}
                    </span>

                    <strong>
                      {route.device ?? '—'}
                    </strong>

                    <span>
                      {route.protocol ?? '—'}
                    </span>

                    <code>
                      {route.metric ?? '—'}
                    </code>
                  </button>
                ),
              )}
            </div>
          ) : (
            <p className="networkToolkitPlaceholder">
              Carregue a tabela de rotas.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
