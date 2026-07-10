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
    (value: string) => string
  >;
};

export function TextTransformTool({
  category,
  title,
  description,
  placeholders,
  transform,
}: TextTransformToolProps) {
  const [mode, setMode] =
    useState<TransformMode>('encode');

  const [input, setInput] =
    useState('');

  const [output, setOutput] =
    useState('');

  const [error, setError] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState(false);

  function resetStatus(): void {
    setError(null);
    setCopied(false);
  }

  function processInput(): void {
    resetStatus();

    if (input.length === 0) {
      setOutput('');

      setError(
        'Digite algum conteúdo antes de executar.',
      );

      return;
    }

    try {
      const result = transform[mode](input);

      setOutput(result);
    } catch (unknownError) {
      setOutput('');

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível processar o conteúdo.',
      );
    }
  }

  function changeMode(
    newMode: TransformMode,
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

    window.zeroHub.clipboard.writeText(
      output,
    );

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  function handleKeyboard(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (
      event.ctrlKey &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      processInput();
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
            onClick={() =>
              changeMode('encode')
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
            onClick={() =>
              changeMode('decode')
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
              {input.length} caracteres
            </span>
          </div>

          <textarea
            id="transform-input"
            value={input}
            spellCheck={false}
            placeholder={placeholders[mode]}
            onChange={(event) => {
              setInput(
                event.target.value,
              );

              resetStatus();
            }}
            onKeyDown={handleKeyboard}
          />
        </div>

        <div className="editorPanel">
          <div className="editorHeader">
            <label htmlFor="transform-output">
              Resultado
            </label>

            <span>
              {output.length} caracteres
            </span>
          </div>

          <textarea
            id="transform-output"
            value={output}
            readOnly
            spellCheck={false}
            placeholder="O resultado aparecerá aqui..."
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
          Ctrl + Enter para executar
        </span>

        <div className="toolActions">
          <button
            className="secondaryButton"
            type="button"
            onClick={clearFields}
          >
            Limpar
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={!output}
            onClick={swapFields}
          >
            Inverter
          </button>

          <button
            className="secondaryButton"
            type="button"
            disabled={!output}
            onClick={copyOutput}
          >
            {copied
              ? 'Copiado'
              : 'Copiar'}
          </button>

          <button
            className="primaryButton"
            type="button"
            onClick={processInput}
          >
            {mode === 'encode'
              ? 'Codificar'
              : 'Decodificar'}
          </button>
        </div>
      </div>
    </section>
  );
}
