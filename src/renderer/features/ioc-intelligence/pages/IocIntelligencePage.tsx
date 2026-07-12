import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  IocIntelligenceTool,
} from '../components/IocIntelligenceTool';

export function IocIntelligencePage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceIoc"
      data-module="ioc-intelligence"
    >
      <ModuleWorkspaceHeader
        abbreviation="IOC"
        badge="4 providers"
        section="Intelligence"
        title="IOC Intelligence"
        description="Enriqueça domínios, URLs, endereços IP e hashes em múltiplas fontes de threat intelligence."
        privacy="External provider queries"
        capabilities={[
          'URLhaus',
          'MalwareBazaar',
          'AbuseIPDB',
          'AlienVault OTX',
        ]}
        workflow={[
          'Input indicators',
          'Select providers',
          'Query reputation',
          'Review evidence',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>INTELLIGENCE FLOW</span>

          <strong>
            Correlate indicators across
            independent providers.
          </strong>

          <p>
            Cada provedor pode retornar
            cobertura e reputação diferentes.
            O resultado final preserva a
            evidência individual de cada
            fonte.
          </p>

          <div>
            <span>
              Batch
              <strong>
                25 IOC
              </strong>
            </span>

            <span>
              Storage
              <strong>
                Secure
              </strong>
            </span>

            <span>
              Submission
              <strong>
                None
              </strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <IocIntelligenceTool />
        </div>
      </section>
    </div>
  );
}

