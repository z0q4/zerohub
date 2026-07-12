import {
  FileForensicsTool,
} from '../components/FileForensicsTool';

export function FileForensicsPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>File Forensics</h1>

          <p>
            Análise estática de arquivos,
            strings, indicadores e formatos
            binários.
          </p>
        </div>

        <span className="operationalBadge">
          1 ferramenta
        </span>
      </header>

      <div className="activeToolContent">
        <FileForensicsTool />
      </div>
    </>
  );
}
