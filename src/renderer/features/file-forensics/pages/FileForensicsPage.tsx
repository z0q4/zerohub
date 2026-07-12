import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  FileForensicsTool,
} from '../components/FileForensicsTool';

export function FileForensicsPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceForensics"
      data-module="file-forensics"
    >
      <ModuleWorkspaceHeader
        abbreviation="FOR"
        badge="Static analysis"
        section="Analysis"
        title="File Forensics"
        description="Investigue arquivos sem executá-los, extraindo metadados, strings, indicadores e estrutura interna."
        privacy="Local and read-only"
        capabilities={[
          'Strings',
          'Indicators',
          'Binary metadata',
          'Archive inventory',
        ]}
        workflow={[
          'Select artifact',
          'Extract metadata',
          'Correlate indicators',
          'Inspect evidence',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>FORENSIC WORKFLOW</span>

          <strong>
            Inspect artifacts without
            executing their contents.
          </strong>

          <p>
            A análise é local e focada em
            evidências estáticas, permitindo
            copiar indicadores e navegar por
            diferentes visões do arquivo.
          </p>

          <div>
            <span>
              Execution
              <strong>
                Blocked
              </strong>
            </span>

            <span>
              Hashing
              <strong>
                Included
              </strong>
            </span>

            <span>
              Archives
              <strong>
                Read-only
              </strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <FileForensicsTool />
        </div>
      </section>
    </div>
  );
}
