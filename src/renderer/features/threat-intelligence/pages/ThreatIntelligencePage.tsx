import {
  useState,
} from 'react';

import {
  VirusTotalFileTool,
} from '../components/VirusTotalFileTool';

import {
  THREAT_INTELLIGENCE_TOOL_REGISTRY,
} from '../threat-intelligence.registry';

import type {
  ThreatIntelligenceToolId,
} from '../threat-intelligence.registry';

export function ThreatIntelligencePage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<ThreatIntelligenceToolId>(
      'virustotal-file',
    );

  function renderTool() {
    switch (activeTool) {
      case 'virustotal-file':
        return (
          <VirusTotalFileTool />
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

          <h1>
            Threat Intelligence
          </h1>

          <p>
            Reputação, detecções e
            inteligência externa sobre
            arquivos.
          </p>
        </div>

        <span className="operationalBadge">
          {
            THREAT_INTELLIGENCE_TOOL_REGISTRY
              .length
          }
          {' '}ferramenta
        </span>
      </header>

      <div className="threatWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">
            FERRAMENTAS
          </span>

          {THREAT_INTELLIGENCE_TOOL_REGISTRY.map(
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
