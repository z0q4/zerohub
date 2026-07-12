import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  WebReconTool,
} from '../components/WebReconTool';

export function WebReconPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceWeb"
      data-module="web-recon"
    >
      <ModuleWorkspaceHeader
        abbreviation="WEB"
        badge="Passive inspection"
        section="Intelligence"
        title="Web Recon"
        description="Inspecione HTTP, TLS, redirecionamentos, headers e arquivos públicos de um alvo web."
        privacy="Passive requests only"
        capabilities={[
          'HTTP',
          'TLS',
          'Redirects',
          'Security headers',
          'robots.txt',
          'sitemap.xml',
        ]}
        workflow={[
          'Enter URL',
          'Fetch metadata',
          'Evaluate posture',
          'Inspect evidence',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>WEB SURFACE</span>

          <strong>
            Build a passive snapshot of a
            public web endpoint.
          </strong>

          <p>
            O módulo coleta somente recursos
            públicos e metadados de
            transporte, sem realizar
            exploração ativa.
          </p>

          <div>
            <span>
              Mode
              <strong>Passive</strong>
            </span>

            <span>
              Protocol
              <strong>HTTP/TLS</strong>
            </span>

            <span>
              Scope
              <strong>Single URL</strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <WebReconTool />
        </div>
      </section>
    </div>
  );
}

