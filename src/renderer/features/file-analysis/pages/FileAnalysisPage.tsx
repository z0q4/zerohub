import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

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
    <div
      className="moduleWorkspace moduleWorkspaceFileAnalysis"
      data-module="file-analysis"
    >
      <ModuleWorkspaceHeader
        abbreviation="FIL"
        badge="Static inspector"
        section="Analysis"
        title="File Analysis"
        description="Inspecione propriedades, integridade, codificação, entropia e metadados de arquivos locais."
        privacy="Local and streaming"
        capabilities={[
          'MIME',
          'Hashes',
          'Entropy',
          'Encoding',
          'Permissions',
        ]}
        workflow={[
          'Select file',
          'Stream analysis',
          'Review metadata',
          'Copy evidence',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>FILE INSPECTION</span>

          <strong>
            Build a technical identity for
            a local artifact.
          </strong>

          <p>
            A leitura em fluxo reduz uso de
            memória e mantém o conteúdo no
            dispositivo durante toda a
            inspeção.
          </p>

          <div>
            <span>
              Read
              <strong>Streaming</strong>
            </span>

            <span>
              Mutation
              <strong>None</strong>
            </span>

            <span>
              Evidence
              <strong>Hashes</strong>
            </span>
          </div>
        </div>

        <div className="fileAnalysisWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              INSPECTORS
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
