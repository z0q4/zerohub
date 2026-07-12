import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  LogAnalysisTool,
} from '../components/LogAnalysisTool';

export function LogAnalysisPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceLogs"
      data-module="log-analysis"
    >
      <ModuleWorkspaceHeader
        abbreviation="LOG"
        badge="Multi-format parser"
        section="Analysis"
        title="Log Analysis"
        description="Extraia eventos, estatísticas, autenticações e padrões de atividade de logs locais."
        privacy="Local parsing"
        capabilities={[
          'Web access logs',
          'SSH and auth',
          'JSON Lines',
          'Generic logs',
          'Timeline',
        ]}
        workflow={[
          'Select log',
          'Detect format',
          'Parse events',
          'Investigate patterns',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>EVENT ANALYSIS</span>

          <strong>
            Turn raw logs into structured
            operational evidence.
          </strong>

          <p>
            O analisador organiza volume,
            severidade, origem, autenticação
            e linha do tempo sem enviar o
            arquivo para serviços externos.
          </p>

          <div>
            <span>
              Lines
              <strong>500k max</strong>
            </span>

            <span>
              Formats
              <strong>Multiple</strong>
            </span>

            <span>
              Parsing
              <strong>Local</strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <LogAnalysisTool />
        </div>
      </section>
    </div>
  );
}
