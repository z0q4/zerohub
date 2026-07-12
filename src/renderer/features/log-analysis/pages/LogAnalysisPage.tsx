import {
  LogAnalysisTool,
} from '../components/LogAnalysisTool';

export function LogAnalysisPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>Log Analysis</h1>

          <p>
            Estatísticas, autenticações,
            erros e atividade extraída de
            logs locais.
          </p>
        </div>

        <span className="operationalBadge">
          1 ferramenta
        </span>
      </header>

      <div className="activeToolContent">
        <LogAnalysisTool />
      </div>
    </>
  );
}
