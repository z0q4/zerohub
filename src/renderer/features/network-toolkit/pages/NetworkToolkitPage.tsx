import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  NetworkToolkitTool,
} from '../components/NetworkToolkitTool';

export function NetworkToolkitPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceNetwork"
      data-module="network-toolkit"
    >
      <ModuleWorkspaceHeader
        abbreviation="NET"
        badge="6 utilities"
        section="Network"
        title="Network Toolkit"
        description="Execute diagnósticos direcionados de conectividade, DNS, rotas, interfaces e endereçamento."
        privacy="Single-target operations"
        capabilities={[
          'Port check',
          'Traceroute',
          'Subnet',
          'DNS',
          'Interfaces',
          'Routes',
        ]}
        workflow={[
          'Choose utility',
          'Configure target',
          'Run diagnostic',
          'Inspect result',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>NETWORK CONSOLE</span>

          <strong>
            Diagnose one target with
            explicit, controlled actions.
          </strong>

          <p>
            O toolkit separa operações por
            contexto e evita execução em
            massa. Resultados são exibidos
            em painéis técnicos e legíveis.
          </p>

          <div>
            <span>
              Target
              <strong>
                Single
              </strong>
            </span>

            <span>
              Mode
              <strong>
                Diagnostic
              </strong>
            </span>

            <span>
              Scope
              <strong>
                Explicit
              </strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <NetworkToolkitTool />
        </div>
      </section>
    </div>
  );
}

