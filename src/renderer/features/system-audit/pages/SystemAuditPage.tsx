import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  SystemAuditTool,
} from '../components/SystemAuditTool';

export function SystemAuditPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceAudit"
      data-module="system-audit"
    >
      <ModuleWorkspaceHeader
        abbreviation="AUD"
        badge="Linux inventory"
        section="Analysis"
        title="System Audit"
        description="Mapeie processos, portas, serviços, inicialização e controles de segurança do sistema Linux."
        privacy="Local and read-only"
        capabilities={[
          'Processes',
          'Listening ports',
          'Services',
          'Autostart',
          'Security controls',
        ]}
        workflow={[
          'Run inventory',
          'Review exposure',
          'Filter findings',
          'Prioritize risks',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>SYSTEM POSTURE</span>

          <strong>
            Build a readable snapshot of
            the local Linux environment.
          </strong>

          <p>
            A auditoria não altera o
            sistema. Ela organiza inventário
            e verificações em visões
            específicas para acelerar a
            revisão.
          </p>

          <div>
            <span>
              Privilege
              <strong>
                User
              </strong>
            </span>

            <span>
              Changes
              <strong>
                None
              </strong>
            </span>

            <span>
              Platform
              <strong>
                Linux
              </strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <SystemAuditTool />
        </div>
      </section>
    </div>
  );
}
