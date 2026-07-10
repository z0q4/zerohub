import {
  useState,
} from 'react';

import type {
  ChangeEvent,
} from 'react';

import type {
  HashAlgorithm,
  HashFileResult,
} from '../../../../shared/hash/hash.types';

type CopiedTarget =
  | 'text'
  | 'file'
  | null;

const ALGORITHMS: readonly {
  id: HashAlgorithm;
  label: string;
}[] = [
  {
    id: 'sha256',
    label: 'SHA-256',
  },
  {
    id: 'sha512',
    label: 'SHA-512',
  },
];

function formatBytes(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 ** 2) {
    return `${(
      bytes / 1024
    ).toFixed(2)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(
      bytes / 1024 ** 2
    ).toFixed(2)} MB`;
  }

  return `${(
    bytes / 1024 ** 3
  ).toFixed(2)} GB`;
}

export function HashTool() {
  const [
    algorithm,
    setAlgorithm,
  ] = useState<HashAlgorithm>(
    'sha256',
  );

  const [
    textInput,
    setTextInput,
  ] = useState('');

  const [
    textDigest,
    setTextDigest,
  ] = useState('');

  const [
    fileResult,
    setFileResult,
  ] =
    useState<HashFileResult | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    copiedTarget,
    setCopiedTarget,
  ] =
    useState<CopiedTarget>(null);

  function handleAlgorithmChange(
    event:
      ChangeEvent<HTMLSelectElement>,
  ): void {
    setAlgorithm(
      event.target
        .value as HashAlgorithm,
    );

    setTextDigest('');
    setFileResult(null);
    setError(null);
    setCopiedTarget(null);
  }

  async function generateTextHash():
    Promise<void> {
    setError(null);
    setCopiedTarget(null);

    if (!textInput) {
      setTextDigest('');

      setError(
        'Digite algum texto para gerar o hash.',
      );

      return;
    }

    setBusy(true);

    try {
      const digest =
        await window.zeroHub.hash.text({
          algorithm,
          text: textInput,
        });

      setTextDigest(digest);
    } catch (unknownError) {
      setTextDigest('');

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível gerar o hash.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function selectFile():
    Promise<void> {
    setError(null);
    setCopiedTarget(null);
    setBusy(true);

    try {
      const result =
        await window.zeroHub.hash
          .selectFile(algorithm);

      if (result) {
        setFileResult(result);
      }
    } catch (unknownError) {
      setFileResult(null);

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível processar o arquivo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function copyDigest(
    value: string,
    target: Exclude<
      CopiedTarget,
      null
    >,
  ): void {
    window.zeroHub.clipboard
      .writeText(value);

    setCopiedTarget(target);

    window.setTimeout(() => {
      setCopiedTarget(null);
    }, 1500);
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            UTILITIES
          </span>

          <h2>Hash Generator</h2>

          <p>
            Gere hashes criptográficos de
            textos e arquivos locais.
          </p>
        </div>

        <label className="algorithmSelector">
          <span>Algoritmo</span>

          <select
            value={algorithm}
            onChange={
              handleAlgorithmChange
            }
          >
            {ALGORITHMS.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.label}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="hashGrid">
        <article className="hashCard">
          <div className="hashCardHeader">
            <div>
              <span>TEXT HASH</span>
              <h3>Texto</h3>
            </div>

            <span>
              {textInput.length}
              {' '}caracteres
            </span>
          </div>

          <textarea
            className="hashTextInput"
            value={textInput}
            spellCheck={false}
            placeholder="Digite o texto que será processado..."
            onChange={(event) => {
              setTextInput(
                event.target.value,
              );

              setTextDigest('');
              setError(null);
            }}
          />

          <div className="hashResult">
            <span>Resultado</span>

            <code>
              {textDigest ||
                'O hash aparecerá aqui...'}
            </code>
          </div>

          <div className="hashActions">
            <button
              className="secondaryButton"
              type="button"
              disabled={!textDigest}
              onClick={() =>
                copyDigest(
                  textDigest,
                  'text',
                )
              }
            >
              {copiedTarget === 'text'
                ? 'Copiado'
                : 'Copiar'}
            </button>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void generateTextHash();
              }}
            >
              {busy
                ? 'Processando...'
                : 'Gerar hash'}
            </button>
          </div>
        </article>

        <article className="hashCard">
          <div className="hashCardHeader">
            <div>
              <span>FILE HASH</span>
              <h3>Arquivo local</h3>
            </div>

            <span>
              {fileResult
                ? formatBytes(
                    fileResult.sizeBytes,
                  )
                : 'Nenhum arquivo'}
            </span>
          </div>

          <button
            className="filePicker"
            type="button"
            disabled={busy}
            onClick={() => {
              void selectFile();
            }}
          >
            <span className="filePickerIcon">
              +
            </span>

            <span>
              <strong>
                Selecionar arquivo
              </strong>

              <small>
                O processamento acontece
                apenas no seu computador.
              </small>
            </span>
          </button>

          <div className="fileInformation">
            <div>
              <span>Nome</span>
              <strong>
                {fileResult?.fileName ??
                  '—'}
              </strong>
            </div>

            <div>
              <span>Caminho</span>
              <strong>
                {fileResult?.filePath ??
                  '—'}
              </strong>
            </div>
          </div>

          <div className="hashResult">
            <span>Resultado</span>

            <code>
              {fileResult?.digest ??
                'O hash do arquivo aparecerá aqui...'}
            </code>
          </div>

          <div className="hashActions">
            <button
              className="secondaryButton"
              type="button"
              disabled={
                !fileResult?.digest
              }
              onClick={() => {
                if (fileResult) {
                  copyDigest(
                    fileResult.digest,
                    'file',
                  );
                }
              }}
            >
              {copiedTarget === 'file'
                ? 'Copiado'
                : 'Copiar hash'}
            </button>

            <button
              className="primaryButton"
              type="button"
              disabled={busy}
              onClick={() => {
                void selectFile();
              }}
            >
              {busy
                ? 'Processando...'
                : 'Abrir arquivo'}
            </button>
          </div>
        </article>
      </div>

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}
    </section>
  );
}
