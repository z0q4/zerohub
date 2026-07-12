import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  SecretScannerTool,
} from '../components/SecretScannerTool';

export function SecretScannerPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceSecrets"
      data-module="secret-scanner"
    >
      <ModuleWorkspaceHeader
        abbreviation="SEC"
        badge="Local scanner"
        section="Analysis"
        title="Secret Scanner"
        description="Audite projetos e arquivos em busca de credenciais, chaves, tokens e material sensível exposto."
        privacy="Local scan with masking"
        capabilities={[
          '.env',
          'API keys',
          'Tokens',
          'JWT',
          'Private keys',
          'High entropy',
        ]}
        workflow={[
          'Select target',
          'Apply filters',
          'Scan locally',
          'Review masked hits',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>SECRET HYGIENE</span>

          <strong>
            Detect exposed credentials
            without rendering their full value.
          </strong>

          <p>
            Os achados são mascarados antes
            de chegar à interface. Pastas de
            dependências e arquivos binários
            são ignorados.
          </p>

          <div>
            <span>
              Masking
              <strong>Enabled</strong>
            </span>

            <span>
              Upload
              <strong>None</strong>
            </span>

            <span>
              Scope
              <strong>Local</strong>
            </span>
          </div>
        </div>

        <div className="secretWorkspace moduleSelectorWorkspace">
          <aside className="toolSelector">
            <span className="toolSelectorLabel">
              SCANNERS
            </span>

            <button
              className="toolSelectorButton active"
              type="button"
            >
              <span className="toolSelectorIcon">
                SEC
              </span>

              <span>
                <strong>
                  Project Secrets
                </strong>

                <small>
                  Tokens, chaves, senhas
                  e arquivos .env.
                </small>
              </span>
            </button>
          </aside>

          <div className="activeToolContent">
            <SecretScannerTool />
          </div>
        </div>
      </section>
    </div>
  );
}
