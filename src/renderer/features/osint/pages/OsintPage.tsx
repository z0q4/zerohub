import {
  useState,
} from 'react';

import {
  RdapDomainTool,
} from '../components/RdapDomainTool';

import {
  OSINT_TOOL_REGISTRY,
} from '../osint.registry';

import type {
  OsintToolId,
} from '../osint.registry';

export function OsintPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<OsintToolId>(
      'rdap-domain',
    );

  function renderTool() {
    switch (activeTool) {
      case 'rdap-domain':
        return (
          <RdapDomainTool />
        );
    }
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>OSINT</h1>

          <p>
            Consulta e organização de
            informações públicas.
          </p>
        </div>

        <span className="operationalBadge">
          {
            OSINT_TOOL_REGISTRY
              .length
          }
          {' '}ferramenta
        </span>
      </header>

      <div className="osintWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
          </span>

          {OSINT_TOOL_REGISTRY.map(
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
