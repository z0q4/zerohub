import { useState } from 'react';

import { Base64Tool } from '../components/Base64Tool';
import { HexTool } from '../components/HexTool';
import { UrlTool } from '../components/UrlTool';

import {
  ENCODING_TOOL_REGISTRY,
} from '../encoding.registry';

import type {
  EncodingToolId,
} from '../encoding.registry';

export function EncodingPage() {
  const [activeTool, setActiveTool] =
    useState<EncodingToolId>('base64');

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
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>Encoding</h1>

          <p>
            Codificação, decodificação e
            transformação de dados.
          </p>
        </div>

        <span className="operationalBadge">
          {ENCODING_TOOL_REGISTRY.length}
          {' '}ferramentas
        </span>
      </header>

      <div className="encodingWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
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
