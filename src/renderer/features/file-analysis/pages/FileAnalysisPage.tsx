import {
  useState,
} from 'react';

import {
  FileInspectorTool,
} from '../components/FileInspectorTool';

import {
  FILE_ANALYSIS_TOOL_REGISTRY,
} from '../file-analysis.registry';

import type {
  FileAnalysisToolId,
} from '../file-analysis.registry';

export function FileAnalysisPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<FileAnalysisToolId>(
      'file-inspector',
    );

  function renderTool() {
    switch (activeTool) {
      case 'file-inspector':
        return <FileInspectorTool />;
    }
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>File Analysis</h1>

          <p>
            Inspeção local de arquivos,
            integridade e metadados.
          </p>
        </div>

        <span className="operationalBadge">
          {
            FILE_ANALYSIS_TOOL_REGISTRY
              .length
          }
          {' '}ferramenta
        </span>
      </header>

      <div className="fileAnalysisWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
          </span>

          {FILE_ANALYSIS_TOOL_REGISTRY.map(
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
                  setActiveTool(
                    tool.id,
                  )
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
