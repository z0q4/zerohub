import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  DnsLookupTool,
} from '../components/DnsLookupTool';

import {
  PingTool,
} from '../components/PingTool';

import {
  NETWORK_TOOL_REGISTRY,
} from '../network.registry';

import type {
  NetworkToolId,
} from '../network.registry';

export function NetworkPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<NetworkToolId>(
      'dns-lookup',
    );

  function renderTool() {
    switch (activeTool) {
      case 'dns-lookup':
        return <DnsLookupTool />;

      case 'ping':
        return <PingTool />;
    }
  }

  return (
    <div
      className="moduleWorkspace moduleWorkspaceNetworkCore"
      data-module="network"
    >
      <ModuleWorkspaceHeader
        abbreviation="NW"
        badge={`${NETWORK_TOOL_REGISTRY.length} diagnostics`}
        section="Network"
        title="Network"
        description="Resolva registros DNS e valide conectividade com operações direcionadas."
        privacy="Explicit network requests"
        capabilities={[
          'DNS lookup',
          'Ping',
          'Record inspection',
          'Latency',
        ]}
        workflow={[
          'Choose diagnostic',
          'Define target',
          'Run request',
          'Inspect response',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>NETWORK DIAGNOSTICS</span>

          <strong>
            Validate name resolution and
            reachability with clear output.
          </strong>

          <p>
            Cada operação exige um alvo
            explícito e apresenta os dados
            em uma estrutura legível para
            investigação rápida.
          </p>

          <div>
            <span>
              Scope
              <strong>Single</strong>
            </span>

            <span>
              Requests
              <strong>Explicit</strong>
            </span>

            <span>
              Output
              <strong>Structured</strong>
            </span>
          </div>
        </div>

        <div className="networkWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              DIAGNOSTICS
            </span>

            {NETWORK_TOOL_REGISTRY.map(
              (tool) => (
                <button
                  className={`toolSelectorButton ${
                    activeTool === tool.id
                      ? 'active'
                      : ''
                  }`}
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(
                      tool.id,
                    );
                  }}
                >
                  <span className="toolSelectorIcon">
                    {tool.abbreviation}
                  </span>

                  <span>
                    <strong>
                      {tool.name}
                    </strong>

                    <small>
                      {tool.description}
                    </small>
                  </span>
                </button>
              ),
            )}
          </aside>

          <div className="activeToolContent">
            {renderTool()}
          </div>
        </div>
      </section>
    </div>
  );
}
