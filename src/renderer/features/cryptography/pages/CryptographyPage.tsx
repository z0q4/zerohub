import {
  CryptographyTool,
} from '../components/CryptographyTool';

export function CryptographyPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>Cryptography</h1>

          <p>
            Operações criptográficas locais
            e inspeção de tokens.
          </p>
        </div>

        <span className="operationalBadge">
          5 ferramentas
        </span>
      </header>

      <div className="activeToolContent">
        <CryptographyTool />
      </div>
    </>
  );
}
