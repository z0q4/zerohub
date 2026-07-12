import {
  ModuleWorkspaceHeader,
} from '../../../components/layout/ModuleWorkspaceHeader';

import {
  CryptographyTool,
} from '../components/CryptographyTool';

export function CryptographyPage() {
  return (
    <div
      className="moduleWorkspace moduleWorkspaceCrypto"
      data-module="cryptography"
    >
      <ModuleWorkspaceHeader
        abbreviation="CRY"
        badge="5 utilities"
        section="Data & Dev"
        title="Cryptography"
        description="Gere assinaturas, derive chaves, crie material aleatório e inspecione tokens sem expor seus dados."
        privacy="Local cryptographic operations"
        capabilities={[
          'HMAC',
          'PBKDF2',
          'Secure random',
          'Passwords',
          'JWT inspector',
        ]}
        workflow={[
          'Choose operation',
          'Provide material',
          'Process locally',
          'Verify output',
        ]}
      />

      <section className="moduleWorkspaceBody">
        <div className="moduleWorkspaceContext">
          <span>CRYPTOGRAPHIC BENCH</span>

          <strong>
            Perform deterministic and
            verifiable operations locally.
          </strong>

          <p>
            Chaves e entradas permanecem no
            dispositivo. O inspetor JWT
            apenas decodifica a estrutura e
            não valida confiança externa.
          </p>

          <div>
            <span>
              Execution
              <strong>Local</strong>
            </span>

            <span>
              Compare
              <strong>Constant-time</strong>
            </span>

            <span>
              Tokens
              <strong>Decode-only</strong>
            </span>
          </div>
        </div>

        <div className="activeToolContent">
          <CryptographyTool />
        </div>
      </section>
    </div>
  );
}
