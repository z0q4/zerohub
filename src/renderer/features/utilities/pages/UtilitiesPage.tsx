import {
  useState,
} from 'react';

import {
  FileCrackerTool,
} from '../components/FileCrackerTool';

import {
  HashTool,
} from '../components/HashTool';

import {
  UTILITY_TOOL_REGISTRY,
} from '../utilities.registry';

import type {
  UtilityToolId,
} from '../utilities.registry';

export function UtilitiesPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<UtilityToolId>('hash');

  function renderTool() {
    switch (activeTool) {
      case 'hash':
        return <HashTool />;
      case 'file-cracker':
        return <FileCrackerTool />;
    }
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>Utilities</h1>

          <p>
            Ferramentas locais para tarefas
            técnicas e análise de dados.
          </p>
        </div>

        <span className="operationalBadge">
          {UTILITY_TOOL_REGISTRY.length}
          {' '}ferramenta
        </span>
      </header>

      <div className="utilitiesWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
          </span>

          {UTILITY_TOOL_REGISTRY.map(
            (tool) => (
              <button
                className={`toolSelectorButton ${
                  activeTool === tool.id
                    ? 'active'
                    : ''
                }`}
                key={tool.id}
                type="button"
                onClick={() =>
                  setActiveTool(tool.id)
                }
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
    </>
  );
}
