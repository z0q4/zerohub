import {
  useEffect,
  useMemo,
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
        'Azul técnico e corporativo.',
    },
    {
      id: 'violet',
      label: 'Violet',
      description:
        'Violeta premium e expressivo.',
    },
    {
      id: 'cyan',
      label: 'Cyan',
      description:
        'Ciano frio, moderno e limpo.',
    },
    {
      id: 'green',
      label: 'Green',
      description:
        'Verde operacional com pegada security.',
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

  const currentAccent =
    useMemo(
      () =>
        ACCENT_OPTIONS.find(
          (option) =>
            option.id ===
            draft.accentColor,
        ) ?? ACCENT_OPTIONS[0],
      [draft.accentColor],
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
            ZEROHUB INTERFACE LAB
          </span>

          <h1>Settings</h1>

          <p>
            Refine aparência, densidade e
            comportamento local do
            aplicativo.
          </p>
        </div>

        <span className="operationalBadge">
          Live theme controls
        </span>
      </header>

      <div className="settingsStudio">
        <section className="settingsPanel settingsMainPanel">
          <div className="settingsSection">
            <div className="settingsSectionHeader">
              <div>
                <span>VISUAL IDENTITY</span>

                <h2>Accent color</h2>

                <p>
                  Controle a cor principal
                  da interface inteira.
                </p>
              </div>
            </div>

            <div className="accentGrid accentGridV4">
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
                <span>LAYOUT</span>

                <h2>Workspace behavior</h2>

                <p>
                  Ajuste densidade e as
                  informações exibidas na
                  shell.
                </p>
              </div>
            </div>

            <label className="settingToggle">
              <div>
                <strong>
                  Modo compacto
                </strong>

                <span>
                  Reduz espaçamentos e
                  deixa a shell mais densa.
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
                  sistema operacional na
                  sidebar.
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

        <aside className="settingsPreviewPanel">
          <header>
            <span>LIVE PREVIEW</span>

            <h2>
              Theme Studio
            </h2>

            <p>
              Prévia do estilo atual da
              interface.
            </p>
          </header>

          <div
            className={`settingsPreviewCard accent-${currentAccent.id}`}
          >
            <div className="settingsPreviewSidebar">
              <span className="settingsPreviewLogo">
                Z
              </span>

              <div>
                <strong>
                  ZeroHub
                </strong>

                <small>
                  {
                    currentAccent.label
                  }
                </small>
              </div>
            </div>

            <div className="settingsPreviewHeader">
              <span>
                Active Theme
              </span>

              <strong>
                {currentAccent.label}
              </strong>
            </div>

            <div className="settingsPreviewBody">
              <div className="settingsPreviewHero">
                <span>
                  Accent
                </span>

                <strong>
                  {
                    currentAccent.description
                  }
                </strong>
              </div>

              <div className="settingsPreviewMiniGrid">
                <article>
                  <span>
                    Density
                  </span>

                  <strong>
                    {draft.compactMode
                      ? 'Compact'
                      : 'Comfort'}
                  </strong>
                </article>

                <article>
                  <span>
                    Runtime
                  </span>

                  <strong>
                    {draft.showRuntimeInfo
                      ? 'Visible'
                      : 'Hidden'}
                  </strong>
                </article>
              </div>

              <div className="settingsPreviewFooter">
                <button
                  className="previewPrimary"
                  type="button"
                >
                  Primary
                </button>

                <button
                  className="previewSecondary"
                  type="button"
                >
                  Secondary
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
