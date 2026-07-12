import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

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
    useState<UtilityToolId>(
      'hash',
    );

  function renderTool() {
    switch (activeTool) {
      case 'hash':
        return <HashTool />;
    }
  }

  return (
    <div
      className="moduleWorkspace moduleWorkspaceUtilities"
      data-module="utilities"
    >
      <ModuleWorkspaceHeader
        abbreviation="UTL"
        badge="Local utilities"
        section="Data & Dev"
        title="Utilities"
        description="Execute tarefas técnicas rápidas com arquivos e dados locais."
        privacy="Local processing"
        capabilities={[
          'SHA-256',
          'SHA-512',
          'Text hashing',
          'File hashing',
        ]}
        workflow={[
          'Choose source',
          'Select algorithm',
          'Calculate locally',
          'Copy digest',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>TECHNICAL UTILITIES</span>

          <strong>
            Generate deterministic digests
            for data and local files.
          </strong>

          <p>
            O hashing de arquivos é feito em
            fluxo para evitar carregar todo
            o conteúdo na memória.
          </p>

          <div>
            <span>
              Algorithms
              <strong>SHA-2</strong>
            </span>

            <span>
              Files
              <strong>Streaming</strong>
            </span>

            <span>
              Output
              <strong>Hex</strong>
            </span>
          </div>
        </div>

        <div className="utilitiesWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              UTILITIES
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
