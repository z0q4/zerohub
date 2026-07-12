import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  EmailSecurityTool,
} from '../components/EmailSecurityTool';

export function EmailSecurityPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceEmail"
      data-module="email-security"
    >
      <ModuleWorkspaceHeader
        abbreviation="MAIL"
        badge="DNS posture"
        section="Intelligence"
        title="Email Security"
        description="Audite a postura de entrega e autenticação de e-mail usando registros DNS públicos."
        privacy="Direct DNS queries"
        capabilities={[
          'MX',
          'SPF',
          'DMARC',
          'DKIM',
          'Posture score',
        ]}
        workflow={[
          'Enter domain',
          'Resolve records',
          'Evaluate policy',
          'Review findings',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>MAIL POSTURE</span>

          <strong>
            Validate authentication and
            delivery controls from DNS.
          </strong>

          <p>
            A análise combina presença,
            política e consistência dos
            registros para gerar uma visão
            objetiva da configuração.
          </p>

          <div>
            <span>
              Source
              <strong>DNS</strong>
            </span>

            <span>
              Changes
              <strong>None</strong>
            </span>

            <span>
              Scope
              <strong>Domain</strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <EmailSecurityTool />
        </div>
      </section>
    </div>
  );
}

