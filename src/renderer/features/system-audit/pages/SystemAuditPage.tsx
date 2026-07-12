import {
  SystemAuditTool,
} from '../components/SystemAuditTool';

export function SystemAuditPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>System Audit</h1>

          <p>
            Inventário e verificações
            locais de segurança para Linux.
          </p>
        </div>

        <span className="operationalBadge">
          1 ferramenta
        </span>
      </header>

      <div className="activeToolContent">
        <SystemAuditTool />
      </div>
    </>
  );
}
