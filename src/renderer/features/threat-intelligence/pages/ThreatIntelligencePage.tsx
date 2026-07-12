import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

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
        return <VirusTotalFileTool />;
    }
  }

  return (
    <div
      className="moduleWorkspace moduleWorkspaceThreat"
      data-module="threat-intelligence"
    >
      <ModuleWorkspaceHeader
        abbreviation="THR"
        badge="VirusTotal"
        section="Intelligence"
        title="Threat Intelligence"
        description="Consulte reputação, detecções e relatórios externos para arquivos, hashes e URLs."
        privacy="External lookups; uploads explicit"
        capabilities={[
          'Hash lookup',
          'File reports',
          'URL reports',
          'Engine detections',
          'Explicit upload',
        ]}
        workflow={[
          'Choose mode',
          'Provide indicator',
          'Query report',
          'Review detections',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>EXTERNAL REPUTATION</span>

          <strong>
            Correlate an artifact with
            multi-engine intelligence.
          </strong>

          <p>
            Consultas por hash e URL são
            separadas de uploads. Arquivos
            só devem ser enviados após uma
            decisão explícita.
          </p>

          <div>
            <span>
              Provider
              <strong>VirusTotal</strong>
            </span>

            <span>
              Upload
              <strong>Explicit</strong>
            </span>

            <span>
              Key
              <strong>Encrypted</strong>
            </span>
          </div>
        </div>

        <div className="threatWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              PROVIDERS
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
