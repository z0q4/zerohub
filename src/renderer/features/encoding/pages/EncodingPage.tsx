import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  Base64Tool,
} from '../components/Base64Tool';

import {
  HexTool,
} from '../components/HexTool';

import {
  UrlTool,
} from '../components/UrlTool';

import {
  ENCODING_TOOL_REGISTRY,
} from '../encoding.registry';

import type {
  EncodingToolId,
} from '../encoding.registry';

export function EncodingPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<EncodingToolId>(
      'base64',
    );

  function renderTool() {
    switch (activeTool) {
      case 'base64':
        return <Base64Tool />;

      case 'url':
        return <UrlTool />;

      case 'hex':
        return <HexTool />;
    }
  }

  return (
    <div
      className="moduleWorkspace moduleWorkspaceEncoding"
      data-module="encoding"
    >
      <ModuleWorkspaceHeader
        abbreviation="ENC"
        badge={`${ENCODING_TOOL_REGISTRY.length} codecs`}
        section="Data & Dev"
        title="Encoding"
        description="Codifique, decodifique e transforme dados em formatos técnicos comuns."
        privacy="Local transformations"
        capabilities={[
          'Base64',
          'URL encoding',
          'Hexadecimal',
        ]}
        workflow={[
          'Select codec',
          'Paste input',
          'Transform',
          'Copy result',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>DATA TRANSFORM</span>

          <strong>
            Convert representations without
            changing the underlying data.
          </strong>

          <p>
            O workspace mantém entrada e
            saída lado a lado para facilitar
            validação, comparação e cópia.
          </p>

          <div>
            <span>
              Processing
              <strong>Local</strong>
            </span>

            <span>
              Input
              <strong>Text</strong>
            </span>

            <span>
              Output
              <strong>Copyable</strong>
            </span>
          </div>
        </div>

        <div className="encodingWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              TRANSFORMERS
            </span>

            {ENCODING_TOOL_REGISTRY.map(
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
