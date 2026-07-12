import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  DeveloperToolsTool,
} from '../components/DeveloperToolsTool';

export function DeveloperToolsPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceDeveloper"
      data-module="developer-tools"
    >
      <ModuleWorkspaceHeader
        abbreviation="DEV"
        badge="7 utilities"
        section="Data & Dev"
        title="Developer Tools"
        description="Formate, converta, valide e compare dados em uma bancada técnica integrada."
        privacy="Local processing"
        capabilities={[
          'JSON',
          'YAML',
          'TOML',
          'Regex',
          'UUID',
          'Timestamp',
          'Diff',
        ]}
        workflow={[
          'Select utility',
          'Provide input',
          'Transform locally',
          'Copy output',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>DEVELOPER BENCH</span>

          <strong>
            Transform structured data
            without leaving the workspace.
          </strong>

          <p>
            Entradas e resultados são
            processados localmente. A
            interface prioriza comparação,
            edição rápida e reutilização do
            resultado.
          </p>

          <div>
            <span>
              Processing
              <strong>
                Local
              </strong>
            </span>

            <span>
              Output
              <strong>
                Copyable
              </strong>
            </span>

            <span>
              Formats
              <strong>
                Multiple
              </strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <DeveloperToolsTool />
        </div>
      </section>
    </div>
  );
}

