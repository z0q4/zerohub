import {
  useState,
} from 'react';

import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  RdapDomainTool,
} from '../components/RdapDomainTool';

import {
  OSINT_TOOL_REGISTRY,
} from '../osint.registry';

import type {
  OsintToolId,
} from '../osint.registry';

type OsintPageProps = {
  contextDomain?: string | null;
  contextIp?: string | null;
};

export function OsintPage({
  contextDomain = null,
  contextIp = null,
}: OsintPageProps) {
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
          <RdapDomainTool
            contextDomain={contextDomain}
            contextIp={contextIp}
          />
        );
    }
  }

  return (
    <div
      className="moduleWorkspace moduleWorkspaceOsint"
      data-module="osint"
    >
      <ModuleWorkspaceHeader
        abbreviation="OSI"
        badge="Public data"
        section="Intelligence"
        title="OSINT"
        description="Consulte e organize informações públicas de infraestrutura e registro."
        privacy="Public RDAP sources"
        capabilities={[
          'RDAP',
          'Domain registration',
          'Entities',
          'Events',
          'Raw response',
        ]}
        workflow={[
          'Enter domain',
          'Query RDAP',
          'Normalize data',
          'Review entities',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>PUBLIC INTELLIGENCE</span>

          <strong>
            Convert registration records
            into an investigation-ready view.
          </strong>

          <p>
            A consulta usa fontes públicas
            RDAP e preserva tanto o resumo
            normalizado quanto a resposta
            original.
          </p>

          <div>
            <span>
              Source
              <strong>RDAP</strong>
            </span>

            <span>
              Data
              <strong>Public</strong>
            </span>

            <span>
              Output
              <strong>Normalized</strong>
            </span>
          </div>
        </div>

        <div className="osintWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              INTELLIGENCE
            </span>

            {OSINT_TOOL_REGISTRY.map(
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
