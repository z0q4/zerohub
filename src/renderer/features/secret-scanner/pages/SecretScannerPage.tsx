import { SecretScannerTool } from '../components/SecretScannerTool';

export function SecretScannerPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">ZEROHUB MODULE</span>
          <h1>Secret Scanner</h1>
          <p>Auditoria local de credenciais expostas em arquivos e projetos.</p>
        </div>
        <span className="operationalBadge">1 ferramenta</span>
      </header>

      <div className="secretWorkspace">
        <aside className="toolSelector">
          <span className="toolSelectorLabel">FERRAMENTAS</span>
          <button className="toolSelectorButton active" type="button">
            <span className="toolSelectorIcon">SEC</span>
            <span><strong>Project Secrets</strong><small>Tokens, chaves, senhas e .env expostos.</small></span>
          </button>
        </aside>
        <div className="activeToolContent"><SecretScannerTool /></div>
      </div>
    </>
  );
}
