import {
  type KeyboardEvent,
  useState,
} from 'react';

export type TransformMode =
  | 'encode'
  | 'decode';

type TextTransformToolProps = {
  category: string;
  title: string;
  description: string;

  placeholders: Record<
    TransformMode,
    string
  >;

  transform: Record<
    TransformMode,
    (
      value: string,
    ) => Promise<string>
  >;
};

export function TextTransformTool({
  category,
  title,
  description,
  placeholders,
  transform,
}: TextTransformToolProps) {
  const [
    mode,
    setMode,
  ] =
    useState<TransformMode>(
      'encode',
    );

  const [
    input,
    setInput,
  ] = useState('');

  const [
    output,
    setOutput,
  ] = useState('');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  function resetStatus(): void {
    setError(null);
    setCopied(false);
  }

  async function processInput():
    Promise<void> {
    if (busy) {
      return;
    }

    resetStatus();

    if (
      input.length === 0
    ) {
      setOutput('');

      setError(
        'Digite algum conteúdo antes de executar.',
      );

      return;
    }

    setBusy(true);

    try {
      const result =
        await transform[mode](
          input,
        );

      setOutput(result);
    } catch (unknownError) {
      setOutput('');

      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível processar o conteúdo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(
    newMode:
      TransformMode,
  ): void {
    setMode(newMode);
    setOutput('');
    resetStatus();
  }

  function clearFields(): void {
    setInput('');
    setOutput('');
    resetStatus();
  }

  function swapFields(): void {
    if (!output) {
      return;
    }

    setInput(output);
    setOutput('');
    resetStatus();

    setMode(
      mode === 'encode'
        ? 'decode'
        : 'encode',
    );
  }

  function copyOutput(): void {
    if (!output) {
      return;
    }

    window.zeroHub
      .clipboard
      .writeText(output);

    setCopied(true);

    window.setTimeout(
      () => {
        setCopied(false);
      },
      1500,
    );
  }

  function handleKeyboard(
    event:
      KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (
      event.ctrlKey &&
      event.key ===
        'Enter'
    ) {
      event.preventDefault();

      void processInput();
    }
  }

  return (
    <section className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <span className="toolCategory">
            {category}
          </span>

          <h2>{title}</h2>

          <p>{description}</p>
        </div>

        <div className="modeSelector">
          <button
            className={
              mode === 'encode'
                ? 'selected'
                : ''
            }
            type="button"
            disabled={busy}
            onClick={() =>
              changeMode(
                'encode',
              )
            }
          >
            Encode
          </button>

          <button
            className={
              mode === 'decode'
                ? 'selected'
                : ''
            }
            type="button"
            disabled={busy}
            onClick={() =>
              changeMode(
                'decode',
              )
            }
          >
            Decode
          </button>
        </div>
      </div>

      <div className="editorGrid">
        <div className="editorPanel">
          <div className="editorHeader">
            <label htmlFor="transform-input">
              Entrada
            </label>

            <span>
              {input.length}
              {' '}caracteres
            </span>
          </div>

          <textarea
            id="transform-input"
            value={input}
            spellCheck={false}
            disabled={busy}
            placeholder={
              placeholders[mode]
            }
            onChange={(event) => {
              setInput(
                event.target.value,
              );

              resetStatus();
            }}
            onKeyDown={
              handleKeyboard
            }
          />
        </div>

        <div className="editorPanel">
          <div className="editorHeader">
            <label htmlFor="transform-output">
              Resultado
            </label>

            <span>
              {output.length}
              {' '}caracteres
            </span>
          </div>

          <textarea
            id="transform-output"
            value={output}
            readOnly
            spellCheck={false}
            placeholder={
              busy
                ? 'Processando no módulo Python...'
                : 'O resultado aparecerá aqui...'
            }
          />
        </div>
      </div>

      {error && (
        <div
          className="toolMessage error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="toolFooter">
        <span className="keyboardHint">
          Python module ·
          Ctrl + Enter para executar
        </span>

        <div className="toolActions">
          <button
            className="secondaryButton"
            type="button"
            disabled={busy}
            onClick={clearFields}
          >
            Limpar
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={
              busy ||
              !output
            }
            onClick={swapFields}
          >
            Inverter
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={
              busy ||
              !output
            }
            onClick={copyOutput}
          >
            {copied
              ? 'Copiado'
              : 'Copiar'}
          </button>

          <button
            className="primaryButton"
            type="button"
            disabled={busy}
            onClick={() => {
              void processInput();
            }}
          >
            {busy
              ? 'Processando...'
              : mode === 'encode'
                ? 'Codificar'
                : 'Decodificar'}
          </button>
        </div>
      </div>
    </section>
  );
}
