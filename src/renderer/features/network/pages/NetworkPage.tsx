import {
  useState,
} from 'react';

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
        return (
          <DnsLookupTool />
        );

      case 'ping':
        return <PingTool />;
    }
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>Network</h1>

          <p>
            Diagnóstico,
            resolução e análise
            de recursos de rede.
          </p>
        </div>

        <span className="operationalBadge">
          {
            NETWORK_TOOL_REGISTRY
              .length
          }
          {' '}ferramentas
        </span>
      </header>

      <div className="networkWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
          </span>

          {NETWORK_TOOL_REGISTRY.map(
            (tool) => (
              <button
                className={`toolSelectorButton ${
                  activeTool ===
                  tool.id
                    ? 'active'
                    : ''
                }`}
                key={tool.id}
                type="button"
                onClick={() =>
                  setActiveTool(
                    tool.id,
                  )
                }
              >
                <span className="toolSelectorIcon">
                  {
                    tool.abbreviation
                  }
                </span>

                <span>
                  <strong>
                    {tool.name}
                  </strong>

                  <small>
                    {
                      tool.description
                    }
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
    </>
  );
}
