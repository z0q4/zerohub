import {
  useEffect,
  useState,
} from 'react';

import {
  DEFAULT_APP_SETTINGS,
} from '../../../../shared/settings/settings.defaults';

import type {
  AccentColor,
  AppSettings,
} from '../../../../shared/settings/settings.types';

type SettingsPageProps = {
  settings: AppSettings;

  onSave(
    settings: AppSettings,
  ): Promise<void>;
};

type AccentOption = {
  id: AccentColor;
  label: string;
  description: string;
};

const ACCENT_OPTIONS:
  readonly AccentOption[] = [
    {
      id: 'blue',
      label: 'Blue',
      description:
        'Azul técnico padrão.',
    },
    {
      id: 'violet',
      label: 'Violet',
      description:
        'Violeta intenso.',
    },
    {
      id: 'cyan',
      label: 'Cyan',
      description:
        'Ciano moderno.',
    },
    {
      id: 'green',
      label: 'Green',
      description:
        'Verde operacional.',
    },
  ];

export function SettingsPage({
  settings,
  onSave,
}: SettingsPageProps) {
  const [
    draft,
    setDraft,
  ] =
    useState<AppSettings>(
      settings,
    );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function saveChanges():
    Promise<void> {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await onSave(draft);

      setMessage(
        'Configurações salvas com sucesso.',
      );
    } catch (unknownError) {
      setError(
        unknownError
          instanceof Error
          ? unknownError.message
          : 'Não foi possível salvar as configurações.',
      );
    } finally {
      setSaving(false);
    }
  }

  function restoreDefaults():
    void {
    setDraft({
      ...DEFAULT_APP_SETTINGS,
    });

    setMessage(null);
    setError(null);
  }

  const hasChanges =
    JSON.stringify(draft) !==
    JSON.stringify(settings);

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB SYSTEM
          </span>

          <h1>Settings</h1>

          <p>
            Aparência e comportamento
            local do aplicativo.
          </p>
        </div>

        <span className="operationalBadge">
          Local persistence
        </span>
      </header>

      <section className="settingsPanel">
        <div className="settingsSection">
          <div className="settingsSectionHeader">
            <div>
              <span>APPEARANCE</span>

              <h2>Cor de destaque</h2>

              <p>
                Escolha a identidade visual
                principal do ZeroHub.
              </p>
            </div>
          </div>

          <div className="accentGrid">
            {ACCENT_OPTIONS.map(
              (option) => (
                <button
                  className={`accentOption ${
                    draft.accentColor ===
                    option.id
                      ? 'active'
                      : ''
                  }`}
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setDraft(
                      (
                        current,
                      ) => ({
                        ...current,

                        accentColor:
                          option.id,
                      }),
                    );

                    setMessage(null);
                  }}
                >
                  <span
                    className={`accentPreview accent-${option.id}`}
                  />

                  <span>
                    <strong>
                      {option.label}
                    </strong>

                    <small>
                      {
                        option.description
                      }
                    </small>
                  </span>
                </button>
              ),
            )}
          </div>
        </div>

        <div className="settingsSection">
          <div className="settingsSectionHeader">
            <div>
              <span>INTERFACE</span>

              <h2>Layout</h2>

              <p>
                Ajuste a densidade e as
                informações exibidas.
              </p>
            </div>
          </div>

          <label className="settingToggle">
            <div>
              <strong>
                Modo compacto
              </strong>

              <span>
                Reduz espaçamentos e o
                tamanho dos painéis.
              </span>
            </div>

            <input
              type="checkbox"
              checked={
                draft.compactMode
              }
              onChange={(event) => {
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    compactMode:
                      event.target
                        .checked,
                  }),
                );

                setMessage(null);
              }}
            />

            <span className="toggleTrack">
              <span />
            </span>
          </label>

          <label className="settingToggle">
            <div>
              <strong>
                Informações de runtime
              </strong>

              <span>
                Exibe Electron, Node e
                plataforma na sidebar.
              </span>
            </div>

            <input
              type="checkbox"
              checked={
                draft.showRuntimeInfo
              }
              onChange={(event) => {
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    showRuntimeInfo:
                      event.target
                        .checked,
                  }),
                );

                setMessage(null);
              }}
            />

            <span className="toggleTrack">
              <span />
            </span>
          </label>
        </div>

        {message && (
          <div
            className="settingsMessage success"
            role="status"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="settingsMessage error"
            role="alert"
          >
            {error}
          </div>
        )}

        <footer className="settingsFooter">
          <span>
            {hasChanges
              ? 'Existem alterações não salvas.'
              : 'Todas as alterações estão salvas.'}
          </span>

          <div>
            <button
              className="secondaryButton"
              type="button"
              disabled={saving}
              onClick={
                restoreDefaults
              }
            >
              Restaurar padrão
            </button>

            <button
              className="primaryButton"
              type="button"
              disabled={
                saving ||
                !hasChanges
              }
              onClick={() => {
                void saveChanges();
              }}
            >
              {saving
                ? 'Salvando...'
                : 'Salvar alterações'}
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}
