import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useCaseWorkspace,
} from '../../cases/CaseWorkspaceContext';


import {
  DEFAULT_APP_SETTINGS,
} from '../../../../shared/settings/settings.defaults';

import type {
  AccentColor,
  AppSettings,
  VisualProfile,
} from '../../../../shared/settings/settings.types';

type SettingsPageProps = {
  settings: AppSettings;
  searchHistoryEnabled: boolean;

  onClearSearchHistory(): void;
  onClearSearchCache(): Promise<boolean>;
  onOpenCases(): void;
  onSearchHistoryEnabledChange(
    enabled: boolean,
  ): void;

  onSave(
    settings: AppSettings,
  ): Promise<void>;
};

type AccentOption = {
  id: AccentColor;
  label: string;
  description: string;
};

type VisualProfileOption = {
  id: VisualProfile;
  label: string;
  description: string;
};

const ACCENT_OPTIONS:
  readonly AccentOption[] = [
    {
      id: 'red',
      label: 'Red',
      description:
        'Vermelho puro, intenso e operacional.',
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

const VISUAL_PROFILE_OPTIONS:
  readonly VisualProfileOption[] = [
    {
      id: 'default',
      label: 'Default',
      description:
        'Mantém a identidade escura com accent color ativo.',
    },
    {
      id: 'monochrome',
      label: 'Black & White',
      description:
        'Perfil preto e branco com contraste seco e minimalista.',
    },
  ];

export function SettingsPage({
  settings,
  searchHistoryEnabled,
  onClearSearchHistory,
  onClearSearchCache,
  onOpenCases,
  onSearchHistoryEnabledChange,
  onSave,
}: SettingsPageProps) {
  const {
    summaries,
    activeCase,
    loading: casesLoading,
    mutating: casesMutating,
    error: casesError,
    selectCase,
  } = useCaseWorkspace();
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
  const [privacyBusy, setPrivacyBusy] =
    useState(false);

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

  const currentVisualProfile =
    useMemo(
      () =>
        VISUAL_PROFILE_OPTIONS.find(
          (option) =>
            option.id ===
            draft.visualProfile,
        ) ?? VISUAL_PROFILE_OPTIONS[0],
      [draft.visualProfile],
    );

  const caseMetrics =
    useMemo(
      () => ({
        total:
          summaries.length,

        active:
          summaries.filter(
            (summary) =>
              summary.status ===
              'active',
          ).length,

        activities:
          summaries.reduce(
            (
              total,
              summary,
            ) =>
              total +
              summary.activityCount,
            0,
          ),
      }),
      [summaries],
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

  async function clearSearchCache():
    Promise<void> {
    setPrivacyBusy(true);
    setMessage(null);
    setError(null);

    try {
      const cleared =
        await onClearSearchCache();

      if (cleared) {
        setMessage(
          'Cache geográfico limpo com sucesso.',
        );
      } else {
        setError(
          'Não foi possível limpar o cache geográfico.',
        );
      }
    } finally {
      setPrivacyBusy(false);
    }
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

            <div className="visualProfileGrid">
              {VISUAL_PROFILE_OPTIONS.map(
                (option) => (
                  <button
                    className={`visualProfileOption ${
                      draft.visualProfile ===
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
                          visualProfile:
                            option.id,
                        }),
                      );

                      setMessage(null);
                    }}
                  >
                    <span
                      className={`visualProfilePreview visual-${option.id}`}
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

            <label className="settingToggle">
              <div>
                <strong>
                  Salvar sessão ao fechar
                </strong>

                <span>
                  Restaura abas, módulos
                  recentes, layout, Focus
                  Mode e perfil ativo ao
                  reabrir. Ao desativar, a
                  sessão anterior é apagada
                  sem remover dados
                  permanentes.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .saveSessionOnClose
                }
                onChange={(event) => {
                  setDraft(
                    (
                      current,
                    ) => ({
                      ...current,
                      saveSessionOnClose:
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

          <div className="settingsSection settingsPrivacySection">
            <div className="settingsSectionHeader">
              <div>
                <span>PRIVACIDADE LOCAL</span>

                <h2>Busca e sessão</h2>

                <p>
                  Controle dados transitórios sem
                  remover perfis, casos ou atividades.
                </p>
              </div>

              <span className="settingsPrivacyBadge">
                {searchHistoryEnabled
                  ? 'Histórico ativo'
                  : 'Privado por padrão'}
              </span>
            </div>

            <label className="settingToggle">
              <div>
                <strong>
                  Histórico de lugares
                </strong>

                <span>
                  Guarda somente locais selecionados.
                  Consultas digitadas não são salvas.
                </span>
              </div>

              <input
                type="checkbox"
                checked={searchHistoryEnabled}
                onChange={(event) => {
                  onSearchHistoryEnabledChange(
                    event.target.checked,
                  );
                  setMessage(
                    event.target.checked
                      ? 'Histórico local de lugares ativado.'
                      : 'Histórico local desativado e removido.',
                  );
                  setError(null);
                }}
              />

              <span className="toggleTrack">
                <span />
              </span>
            </label>

            <div className="settingsPrivacyActions">
              <button
                className="secondaryButton"
                type="button"
                disabled={privacyBusy}
                onClick={() => {
                  onClearSearchHistory();
                  setMessage(
                    'Histórico geográfico removido.',
                  );
                  setError(null);
                }}
              >
                Limpar histórico
              </button>

              <button
                className="secondaryButton"
                type="button"
                disabled={privacyBusy}
                onClick={() => {
                  void clearSearchCache();
                }}
              >
                {privacyBusy
                  ? 'Limpando cache…'
                  : 'Limpar cache geográfico'}
              </button>
            </div>

            <p className="settingsPrivacyNote">
              Desative “Salvar sessão ao fechar” e salve
              para remover o snapshot restaurável da
              interface. Dados permanentes dos casos não
              são apagados.
            </p>
          </div>

          <div className="settingsSection settingsCasesSection">
            <div className="settingsSectionHeader">
              <div>
                <span>
                  INVESTIGATION PROFILES
                </span>

                <h2>
                  Perfis e investigações
                </h2>

                <p>
                  Selecione o perfil ativo ou
                  abra o workspace completo de
                  investigação.
                </p>
              </div>

              <span
                className={`settingsCasesBadge ${
                  activeCase
                    ? 'active'
                    : ''
                }`}
              >
                {activeCase
                  ? 'Perfil ativo'
                  : 'Sem perfil'}
              </span>
            </div>

            <div className="settingsCasesOverview">
              <div className="settingsCasesIdentity">
                <span
                  className="settingsCasesIndicator"
                  aria-hidden="true"
                />

                <div>
                  <small>
                    PERFIL ATUAL
                  </small>

                  <strong>
                    {activeCase
                      ? activeCase.name
                      : 'Nenhum perfil selecionado'}
                  </strong>

                  <p>
                    {activeCase
                      ? (
                          activeCase.description ||
                          'Perfil sem descrição.'
                        )
                      : 'As ferramentas ainda não estão vinculadas a uma investigação.'}
                  </p>
                </div>
              </div>

              <div className="settingsCasesMetrics">
                <article>
                  <span>PERFIS</span>

                  <strong>
                    {caseMetrics.total}
                  </strong>
                </article>

                <article>
                  <span>ATIVOS</span>

                  <strong>
                    {caseMetrics.active}
                  </strong>
                </article>

                <article>
                  <span>EVENTOS</span>

                  <strong>
                    {
                      caseMetrics.activities
                    }
                  </strong>
                </article>
              </div>
            </div>

            <div className="settingsCasesControls">
              <label>
                <span>
                  Perfil ativo
                </span>

                <select
                  value={
                    activeCase?.id ?? ''
                  }
                  disabled={
                    casesLoading ||
                    casesMutating
                  }
                  onChange={(event) => {
                    const caseId =
                      event.target.value ||
                      null;

                    setError(null);
                    setMessage(null);

                    selectCase(caseId)
                      .catch(
                        (unknownError) => {
                          setError(
                            unknownError
                              instanceof Error
                              ? unknownError.message
                              : 'Não foi possível selecionar o perfil.',
                          );
                        },
                      );
                  }}
                >
                  <option value="">
                    Nenhum perfil ativo
                  </option>

                  {summaries.map(
                    (summary) => (
                      <option
                        key={summary.id}
                        value={summary.id}
                      >
                        {summary.name}
                        {' · '}
                        {
                          summary.activityCount
                        }
                        {' eventos'}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="settingsCasesActions">
                <button
                  className="secondaryButton"
                  type="button"
                  disabled={
                    casesMutating ||
                    !activeCase
                  }
                  onClick={() => {
                    setError(null);
                    setMessage(null);

                    selectCase(null)
                      .catch(
                        (unknownError) => {
                          setError(
                            unknownError
                              instanceof Error
                              ? unknownError.message
                              : 'Não foi possível desativar o perfil.',
                          );
                        },
                      );
                  }}
                >
                  Desativar perfil
                </button>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={
                    onOpenCases
                  }
                >
                  Abrir gerenciador
                </button>
              </div>
            </div>

            <footer className="settingsCasesFooter">
              <span>
                Armazenamento local
              </span>

              <strong>
                userData/cases/cases.v1.json
              </strong>
            </footer>
          </div>

          {message && (
            <div
              className="settingsMessage success"
              role="status"
            >
              {message}
            </div>
          )}

          {(error || casesError) && (
            <div
              className="settingsMessage error"
              role="alert"
            >
              {error ?? casesError}
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
            className={`settingsPreviewCard accent-${currentAccent.id} visual-${currentVisualProfile.id}`}
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
                    currentVisualProfile.label
                  }
                </small>
              </div>
            </div>

            <div className="settingsPreviewHeader">
              <span>
                Active Theme
              </span>

              <strong>
                {
                  currentVisualProfile.label
                }
              </strong>
            </div>

            <div className="settingsPreviewBody">
              <div className="settingsPreviewHero">
                <span>
                  Accent
                </span>

                <strong>
                  {
                    currentVisualProfile.description
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
