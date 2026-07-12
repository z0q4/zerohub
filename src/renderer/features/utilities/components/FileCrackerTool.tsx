import { useState } from 'react';

import type {
  FileCrackMode,
  FileCrackRequest,
  FileCrackResult,
} from '../../../../shared/file-cracker/file-cracker.types';

const MODES: readonly { id: FileCrackMode; label: string }[] = [
  { id: 'bruteforce', label: 'Brute force' },
  { id: 'wordlist', label: 'Wordlist' },
];

function getFileCrackerApi() {
  if (!window.zeroHub?.fileCracker) {
    throw new Error('A ponte de comunicação do ZeroHub não está disponível no renderer.');
  }

  return window.zeroHub.fileCracker;
}

export function FileCrackerTool() {
  const [zipPath, setZipPath] = useState('');
  const [wordlistPath, setWordlistPath] = useState('');
  const [mode, setMode] = useState<FileCrackMode>('bruteforce');
  const [length, setLength] = useState(4);
  const [useLetters, setUseLetters] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileCrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickZipPath() {
    setError(null);
    const api = getFileCrackerApi();
    const selected = await api.selectZip();
    if (selected) {
      setZipPath(selected);
    }
  }

  async function pickWordlistPath() {
    setError(null);
    const api = getFileCrackerApi();
    const selected = await api.selectWordlist();
    if (selected) {
      setWordlistPath(selected);
    }
  }

  async function crack() {
    setError(null);
    setResult(null);
    setBusy(true);

    try {
      const request: FileCrackRequest = {
        zipPath,
        mode,
        wordlistPath: mode === 'wordlist' ? wordlistPath : undefined,
        length,
        useLetters,
        useNumbers,
        useSpecial,
      };

      const api = getFileCrackerApi();
      const response = await api.crack(request);
      setResult(response);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível executar o ataque.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">UTILITIES · PYTHON</span>
          <h2>ZIP Password Cracker</h2>
          <p>Quebre senhas de arquivos ZIP usando brute force ou wordlist localmente.</p>
        </div>
      </div>

      <div className="hashGrid">
        <article className="hashCard">
          <div className="hashCardHeader">
            <div>
              <span>ATTACK</span>
              <h3>Configuração</h3>
            </div>
          </div>

          <label className="algorithmSelector">
            <span>Modo</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as FileCrackMode)}>
              {MODES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="algorithmSelector">
            <span>Arquivo ZIP</span>
            <div className="hashActions">
              <input className="hashTextInput" value={zipPath} onChange={(event) => setZipPath(event.target.value)} placeholder="Caminho do arquivo .zip" />
              <button className="secondaryButton" type="button" onClick={() => { void pickZipPath(); }}>Procurar</button>
            </div>
          </label>

          {mode === 'wordlist' && (
            <label className="algorithmSelector">
              <span>Wordlist</span>
              <div className="hashActions">
                <input className="hashTextInput" value={wordlistPath} onChange={(event) => setWordlistPath(event.target.value)} placeholder="Caminho da wordlist" />
                <button className="secondaryButton" type="button" onClick={() => { void pickWordlistPath(); }}>Procurar</button>
              </div>
            </label>
          )}

          {mode === 'bruteforce' && (
            <>
              <label className="algorithmSelector">
                <span>Tamanho da senha</span>
                <input type="number" min={1} max={10} value={length} onChange={(event) => setLength(Number(event.target.value))} />
              </label>

              <div className="hashActions">
                <label>
                  <input type="checkbox" checked={useLetters} onChange={(event) => setUseLetters(event.target.checked)} /> Letras
                </label>
                <label>
                  <input type="checkbox" checked={useNumbers} onChange={(event) => setUseNumbers(event.target.checked)} /> Números
                </label>
                <label>
                  <input type="checkbox" checked={useSpecial} onChange={(event) => setUseSpecial(event.target.checked)} /> Especiais
                </label>
              </div>
            </>
          )}

          <div className="hashActions">
            <button className="primaryButton" type="button" disabled={busy || !zipPath || (mode === 'wordlist' && !wordlistPath)} onClick={() => { void crack(); }}>
              {busy ? 'Processando...' : 'Executar ataque'}
            </button>
          </div>
        </article>

        <article className="hashCard">
          <div className="hashCardHeader">
            <div>
              <span>RESULT</span>
              <h3>Resultado</h3>
            </div>
          </div>

          {result ? (
            <div className="fileInformation">
              <div>
                <span>Status</span>
                <strong>{result.found ? 'Senha encontrada' : 'Senha não encontrada'}</strong>
              </div>
              <div>
                <span>Senha</span>
                <strong>{result.password ?? '—'}</strong>
              </div>
              <div>
                <span>Tentativas</span>
                <strong>{result.attempts}</strong>
              </div>
              <div>
                <span>Mensagem</span>
                <strong>{result.message}</strong>
              </div>
            </div>
          ) : (
            <p>Os resultados do ataque aparecerão aqui.</p>
          )}

          {error && <div className="toolMessage error" role="alert">{error}</div>}
        </article>
      </div>
    </section>
  );
}
