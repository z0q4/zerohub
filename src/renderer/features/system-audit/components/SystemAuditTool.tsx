import {
  useMemo,
  useState,
} from 'react';

import type {
  SystemAuditResult,
} from '../../../../shared/system-audit/system-audit.types';

type AuditTab =
  | 'overview'
  | 'network'
  | 'processes'
  | 'services'
  | 'startup'
  | 'security';

function formatBytes(
  bytes: number,
): string {
  if (bytes <= 0) {
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

function formatDuration(
  seconds: number | null,
): string {
  if (
    seconds === null ||
    !Number.isFinite(seconds)
  ) {
    return 'Não identificado';
  }

  const days =
    Math.floor(
      seconds / 86400,
    );

  const hours =
    Math.floor(
      (
        seconds % 86400
      ) / 3600,
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60,
    );

  return `${days}d ${hours}h ${minutes}m`;
}

function securityLabel(
  value: boolean | null,
): string {
  if (value === null) {
    return 'Não identificado';
  }

  return value
    ? 'Ativo'
    : 'Inativo';
}

export function SystemAuditTool() {
  const [
    result,
    setResult,
  ] =
    useState<SystemAuditResult | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<AuditTab>(
      'overview',
    );

  const [
    filter,
    setFilter,
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

  const query =
    filter
      .trim()
      .toLowerCase();

  const filteredProcesses =
    useMemo(
      () => {
        if (!result) {
          return [];
        }

        if (!query) {
          return result.processes;
        }

        return result.processes.filter(
          (process) =>
            [
              process.name,
              process.user ?? '',
              String(process.pid),
              process.state,
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(query),
            ),
        );
      },
      [
        query,
        result,
      ],
    );

  const filteredServices =
    useMemo(
      () => {
        if (!result) {
          return [];
        }

        if (!query) {
          return result.services;
        }

        return result.services.filter(
          (service) =>
            [
              service.unit,
              service.description,
              service.active,
              service.sub,
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(query),
            ),
        );
      },
      [
        query,
        result,
      ],
    );

  async function runAudit():
    Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const audit =
        await window.zeroHub
          .systemAudit
          .run();

      setResult(audit);
      setActiveTab('overview');
      setFilter('');
    } catch (unknownError) {
      setResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível executar a auditoria.',
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
            SYSTEM AUDIT · PYTHON
          </span>

          <h2>Linux System Audit</h2>

          <p>
            Inventário local de processos,
            portas, serviços, inicialização
            e configurações de segurança.
          </p>
        </div>

        <span className="nativeToolBadge">
          No Root
        </span>
      </div>

      <div className="auditToolbar">
        <div>
          <strong>
            Auditoria somente leitura
          </strong>

          <span>
            Nenhuma configuração do sistema
            será alterada.
          </span>
        </div>

        <button
          className="primaryButton"
          type="button"
          disabled={busy}
          onClick={() => {
            void runAudit();
          }}
        >
          {busy
            ? 'Auditando...'
            : result
              ? 'Executar novamente'
              : 'Executar auditoria'}
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
        <div className="auditEmpty">
          <span>SYS</span>

          <h3>
            Auditoria ainda não executada
          </h3>

          <p>
            Execute a análise para obter um
            inventário do sistema Linux.
          </p>
        </div>
      )}

      {result && (
        <div className="auditResults">
          <div className="auditHero">
            <div>
              <span>SISTEMA</span>

              <h3>
                {result.system.hostname}
              </h3>

              <code>
                {result.system.distribution}
                {' · '}
                {result.system.kernel}
              </code>
            </div>

            <div>
              <strong>
                {result.user.username}
              </strong>

              <small>
                UID {result.user.uid}
                {' · '}
                {result.elapsedMs} ms
              </small>
            </div>
          </div>

          <div className="auditStats">
            <article>
              <span>PROCESSOS</span>
              <strong>
                {result.counts.processes}
              </strong>
            </article>

            <article>
              <span>PORTAS</span>
              <strong>
                {
                  result.counts
                    .listeningPorts
                }
              </strong>
            </article>

            <article>
              <span>SERVIÇOS</span>
              <strong>
                {result.counts.services}
              </strong>
            </article>

            <article
              className={
                result.counts
                  .permissionRisks > 0
                  ? 'warning'
                  : ''
              }
            >
              <span>RISCOS</span>
              <strong>
                {
                  result.counts
                    .permissionRisks
                }
              </strong>
            </article>
          </div>

          <div className="auditTabs">
            {(
              [
                [
                  'overview',
                  'Resumo',
                ],
                [
                  'network',
                  'Rede',
                ],
                [
                  'processes',
                  'Processos',
                ],
                [
                  'services',
                  'Serviços',
                ],
                [
                  'startup',
                  'Inicialização',
                ],
                [
                  'security',
                  'Segurança',
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
                  onClick={() => {
                    setActiveTab(id);
                    setFilter('');
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {activeTab ===
            'overview' && (
            <div className="auditGrid">
              <article className="auditCard">
                <header>
                  <span>SISTEMA</span>
                </header>

                <dl>
                  <div>
                    <dt>Distribuição</dt>
                    <dd>
                      {
                        result.system
                          .distribution
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Kernel</dt>
                    <dd>
                      {result.system.kernel}
                    </dd>
                  </div>

                  <div>
                    <dt>Arquitetura</dt>
                    <dd>
                      {
                        result.system.cpu
                          .architecture
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Uptime</dt>
                    <dd>
                      {formatDuration(
                        result.system
                          .uptimeSeconds,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="auditCard">
                <header>
                  <span>HARDWARE</span>
                </header>

                <dl>
                  <div>
                    <dt>CPU</dt>
                    <dd>
                      {
                        result.system.cpu
                          .model ??
                        'Não identificada'
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Núcleos lógicos</dt>
                    <dd>
                      {
                        result.system.cpu
                          .logicalCores
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Memória usada</dt>
                    <dd>
                      {formatBytes(
                        result.system
                          .memory
                          .usedBytes,
                      )}
                      {' / '}
                      {formatBytes(
                        result.system
                          .memory
                          .totalBytes,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Disco usado</dt>
                    <dd>
                      {formatBytes(
                        result.system.disk
                          .usedBytes,
                      )}
                      {' / '}
                      {formatBytes(
                        result.system.disk
                          .totalBytes,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="auditCard">
                <header>
                  <span>USUÁRIO</span>
                </header>

                <dl>
                  <div>
                    <dt>Usuário</dt>
                    <dd>
                      {result.user.username}
                    </dd>
                  </div>

                  <div>
                    <dt>UID / GID</dt>
                    <dd>
                      {result.user.uid}
                      {' / '}
                      {result.user.gid}
                    </dd>
                  </div>

                  <div>
                    <dt>Home</dt>
                    <dd>
                      {result.user.home}
                    </dd>
                  </div>

                  <div>
                    <dt>Grupos</dt>
                    <dd>
                      {result.user.groups
                        .join(', ') ||
                        'Nenhum'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="auditCard">
                <header>
                  <span>SEGURANÇA</span>
                </header>

                <dl>
                  <div>
                    <dt>Secure Boot</dt>
                    <dd>
                      {securityLabel(
                        result.security
                          .secureBoot
                          .enabled,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>AppArmor</dt>
                    <dd>
                      {securityLabel(
                        result.security
                          .apparmorEnabled,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>ASLR</dt>
                    <dd>
                      {result.security
                        .aslrMode ??
                        'Não identificado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Firewall ativo</dt>
                    <dd>
                      {result.security
                        .firewalls
                        .filter(
                          (firewall) =>
                            firewall.active,
                        )
                        .map(
                          (firewall) =>
                            firewall.name,
                        )
                        .join(', ') ||
                        'Nenhum detectado'}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          )}

          {activeTab ===
            'network' && (
            <article className="auditTablePanel">
              <header>
                <div>
                  <span>
                    PORTAS EM ESCUTA
                  </span>

                  <strong>
                    {
                      result.listeningPorts
                        .length
                    }
                  </strong>
                </div>
              </header>

              <div className="auditTable">
                <div className="auditTableHeader">
                  <span>PROTOCOLO</span>
                  <span>ENDEREÇO</span>
                  <span>PORTA</span>
                  <span>PROCESSO</span>
                  <span>PID</span>
                </div>

                {result.listeningPorts.map(
                  (
                    port,
                    index,
                  ) => (
                    <div
                      key={`${port.protocol}-${port.localAddress}-${port.localPort}-${index}`}
                    >
                      <code>
                        {port.protocol}
                      </code>

                      <span>
                        {port.localAddress}
                      </span>

                      <strong>
                        {port.localPort}
                      </strong>

                      <span>
                        {port.processName ??
                          'Oculto'}
                      </span>

                      <code>
                        {port.pid ??
                          '—'}
                      </code>
                    </div>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'processes' && (
            <article className="auditTablePanel">
              <header>
                <div>
                  <span>PROCESSOS</span>

                  <strong>
                    {
                      filteredProcesses
                        .length
                    }
                  </strong>
                </div>

                <input
                  value={filter}
                  type="search"
                  placeholder="Filtrar PID, nome ou usuário..."
                  onChange={(event) => {
                    setFilter(
                      event.target.value,
                    );
                  }}
                />
              </header>

              <div className="auditTable processes">
                <div className="auditTableHeader">
                  <span>PID</span>
                  <span>PROCESSO</span>
                  <span>USUÁRIO</span>
                  <span>MEMÓRIA</span>
                  <span>THREADS</span>
                </div>

                {filteredProcesses.map(
                  (process) => (
                    <div
                      key={process.pid}
                    >
                      <code>
                        {process.pid}
                      </code>

                      <strong>
                        {process.name}
                      </strong>

                      <span>
                        {process.user ??
                          'Desconhecido'}
                      </span>

                      <span>
                        {formatBytes(
                          process.memoryBytes,
                        )}
                      </span>

                      <code>
                        {process.threads}
                      </code>
                    </div>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'services' && (
            <article className="auditTablePanel">
              <header>
                <div>
                  <span>
                    SERVIÇOS EM EXECUÇÃO
                  </span>

                  <strong>
                    {
                      filteredServices
                        .length
                    }
                  </strong>
                </div>

                <input
                  value={filter}
                  type="search"
                  placeholder="Filtrar serviço..."
                  onChange={(event) => {
                    setFilter(
                      event.target.value,
                    );
                  }}
                />
              </header>

              <div className="auditServiceList">
                {filteredServices.map(
                  (service) => (
                    <div
                      key={service.unit}
                    >
                      <code>
                        {service.unit}
                      </code>

                      <span>
                        {service.description}
                      </span>

                      <strong>
                        {service.sub}
                      </strong>
                    </div>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'startup' && (
            <article className="auditTablePanel">
              <header>
                <div>
                  <span>
                    APLICATIVOS DE INICIALIZAÇÃO
                  </span>

                  <strong>
                    {
                      result.startupItems
                        .length
                    }
                  </strong>
                </div>
              </header>

              <div className="auditStartupList">
                {result.startupItems.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={`${item.path}-${index}`}
                    >
                      <div>
                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          {item.scope}
                          {item.hidden
                            ? ' · oculto'
                            : ''}
                        </span>
                      </div>

                      <code>
                        {item.command ??
                          'Sem Exec'}
                      </code>

                      <small>
                        {item.path}
                      </small>
                    </div>
                  ),
                )}
              </div>
            </article>
          )}

          {activeTab ===
            'security' && (
            <div className="auditGrid">
              <article className="auditCard">
                <header>
                  <span>PROTEÇÕES</span>
                </header>

                <dl>
                  <div>
                    <dt>Secure Boot</dt>
                    <dd>
                      {securityLabel(
                        result.security
                          .secureBoot
                          .enabled,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Detalhes</dt>
                    <dd>
                      {
                        result.security
                          .secureBoot
                          .details
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>AppArmor</dt>
                    <dd>
                      {securityLabel(
                        result.security
                          .apparmorEnabled,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>ASLR</dt>
                    <dd>
                      {result.security
                        .aslrMode ??
                        'Não identificado'}
                    </dd>
                  </div>

                  <div>
                    <dt>ptrace_scope</dt>
                    <dd>
                      {result.security
                        .ptraceScope ??
                        'Não identificado'}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="auditCard">
                <header>
                  <span>FIREWALLS</span>
                </header>

                <dl>
                  {result.security
                    .firewalls
                    .map(
                      (firewall) => (
                        <div
                          key={
                            firewall.name
                          }
                        >
                          <dt>
                            {firewall.name}
                          </dt>

                          <dd>
                            {firewall.active
                              ? 'Ativo'
                              : firewall.state}
                          </dd>
                        </div>
                      ),
                    )}
                </dl>
              </article>

              <article className="auditRiskPanel">
                <header>
                  <span>
                    PERMISSÕES ARRISCADAS
                  </span>

                  <strong>
                    {
                      result.permissionRisks
                        .length
                    }
                  </strong>
                </header>

                {result.permissionRisks
                  .length === 0 ? (
                  <p>
                    Nenhuma permissão
                    arriscada foi detectada
                    nos locais verificados.
                  </p>
                ) : (
                  <div>
                    {result.permissionRisks.map(
                      (
                        risk,
                        index,
                      ) => (
                        <article
                          className={
                            risk.severity
                          }
                          key={`${risk.path}-${index}`}
                        >
                          <div>
                            <strong>
                              {
                                risk.category
                              }
                            </strong>

                            <code>
                              {
                                risk.permissions
                              }
                            </code>
                          </div>

                          <p>
                            {
                              risk.description
                            }
                          </p>

                          <small>
                            {risk.path}
                          </small>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
