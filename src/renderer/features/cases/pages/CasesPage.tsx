import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import type {
  CaseCreateInput,
  CaseTargetKind,
} from '../../../../shared/cases/cases.types';

import {
  useCaseWorkspace,
} from '../CaseWorkspaceContext';

import {
  CaseProfileEditor,
} from '../components/CaseProfileEditor';

import {
  CaseTargetManager,
} from '../components/CaseTargetManager';

import {
  STATUS_LABELS,
  TARGET_LABELS,
} from '../cases.constants';

const DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  );

type CreateDraft = {
  name: string;
  description: string;
  tags: string;
  targetKind: CaseTargetKind;
  targetValue: string;
  targetLabel: string;
};

const EMPTY_DRAFT:
  CreateDraft = {
    name: '',
    description: '',
    tags: '',
    targetKind: 'domain',
    targetValue: '',
    targetLabel: '',
  };

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return DATE_FORMATTER.format(
    date,
  );
}

function stringifyValue(
  value: unknown,
): string {
  try {
    const serialized =
      JSON.stringify(
        value,
        null,
        2,
      );

    return (
      serialized ??
      String(value)
    );
  } catch {
    return String(value);
  }
}

export function CasesPage() {
  const {
    summaries,
    activeCase,
    loading,
    mutating,
    error,
    createCase,
    selectCase,
    addActivity,
    updateStatus,
  } = useCaseWorkspace();

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    draft,
    setDraft,
  ] =
    useState<CreateDraft>({
      ...EMPTY_DRAFT,
    });

  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    noteTitle,
    setNoteTitle,
  ] = useState(
    'Nota de investigação',
  );

  const [
    noteBody,
    setNoteBody,
  ] = useState('');

  const normalizedQuery =
    query.trim().toLowerCase();

  const filteredSummaries =
    useMemo(
      () => {
        if (!normalizedQuery) {
          return summaries;
        }

        return summaries.filter(
          (summary) => {
            const haystack = [
              summary.name,
              summary.description,
              summary.status,
              ...summary.tags,
            ]
              .join(' ')
              .toLowerCase();

            return haystack.includes(
              normalizedQuery,
            );
          },
        );
      },
      [
        normalizedQuery,
        summaries,
      ],
    );

  const totalActivities =
    summaries.reduce(
      (
        total,
        summary,
      ) =>
        total +
        summary.activityCount,
      0,
    );

  const activeCount =
    summaries.filter(
      (summary) =>
        summary.status ===
        'active',
    ).length;

  async function handleCreate(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const name =
      draft.name.trim();

    if (!name) {
      setFormError(
        'Informe um nome para o perfil.',
      );
      return;
    }

    const targetValue =
      draft.targetValue.trim();

    const input:
      CaseCreateInput = {
        name,
        description:
          draft.description.trim(),
        tags:
          draft.tags
            .split(',')
            .map(
              (tag) =>
                tag.trim(),
            )
            .filter(Boolean),
        primaryTarget:
          targetValue
            ? {
                kind:
                  draft.targetKind,
                value:
                  targetValue,
                label:
                  draft.targetLabel
                    .trim(),
              }
            : undefined,
      };

    try {
      await createCase(input);

      setDraft({
        ...EMPTY_DRAFT,
      });

      setCreating(false);
    } catch (unknownError) {
      setFormError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível criar o perfil.',
      );
    }
  }

  async function handleAddNote(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    if (!activeCase) {
      return;
    }

    if (
      !noteTitle.trim() ||
      !noteBody.trim()
    ) {
      setFormError(
        'Informe o título e o conteúdo da nota.',
      );
      return;
    }

    try {
      await addActivity({
        caseId:
          activeCase.id,
        moduleId:
          'case-workspace',
        action:
          'manual-note',
        title:
          noteTitle.trim(),
        status: 'info',
        note:
          noteBody.trim(),
      });

      setNoteTitle(
        'Nota de investigação',
      );

      setNoteBody('');
    } catch (unknownError) {
      setFormError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível salvar a nota.',
      );
    }
  }

  return (
    <div className="casesPage">
      <section className="casesHero">
        <div>
          <span className="eyebrow">
            ZEROHUB · INVESTIGATION WORKSPACE
          </span>

          <h1>
            Perfis do alvo
          </h1>

          <p>
            Organize alvos, resultados,
            observações e evidências em uma
            timeline persistente.
          </p>
        </div>

        <div className="casesHeroMetrics">
          <article>
            <span>PERFIS</span>
            <strong>
              {summaries.length}
            </strong>
          </article>

          <article>
            <span>ATIVOS</span>
            <strong>
              {activeCount}
            </strong>
          </article>

          <article>
            <span>EVENTOS</span>
            <strong>
              {totalActivities}
            </strong>
          </article>
        </div>
      </section>

      <section className="casesToolbar">
        <div>
          <span
            className={
              activeCase
                ? 'online'
                : ''
            }
          />

          <div>
            <small>
              PERFIL ATIVO
            </small>

            <strong>
              {activeCase
                ? activeCase.name
                : 'Nenhum perfil selecionado'}
            </strong>
          </div>
        </div>

        <button
          className="primaryButton"
          type="button"
          onClick={() => {
            setCreating(
              (current) =>
                !current,
            );
          }}
        >
          {creating
            ? 'Fechar criação'
            : 'Novo perfil'}
        </button>
      </section>

      {(error || formError) && (
        <div
          className="caseError"
          role="alert"
        >
          {formError ?? error}
        </div>
      )}

      {creating && (
        <form
          className="caseCreatePanel"
          onSubmit={(event) => {
            handleCreate(event)
              .catch(
                (unknownError) => {
                  console.error(
                    'Falha inesperada ao criar perfil.',
                    unknownError,
                  );
                },
              );
          }}
        >
          <header>
            <div>
              <span>
                CREATE PROFILE
              </span>

              <h2>
                Novo perfil de investigação
              </h2>
            </div>

            <small>
              Persistência local
            </small>
          </header>

          <div className="caseFormGrid">
            <label className="caseField">
              <span>Nome do perfil</span>

              <input
                required
                maxLength={120}
                value={draft.name}
                placeholder="Operação example.com"
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>

            <label className="caseField">
              <span>Tags</span>

              <input
                maxLength={400}
                value={draft.tags}
                placeholder="cliente, web, prioridade"
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      tags:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>

            <label className="caseField caseFieldWide">
              <span>Descrição</span>

              <textarea
                maxLength={2000}
                value={
                  draft.description
                }
                placeholder="Contexto, escopo autorizado e objetivo da investigação..."
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>
          </div>

          <div className="caseTargetComposer">
            <label className="caseField">
              <span>Tipo do alvo</span>

              <select
                value={
                  draft.targetKind
                }
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      targetKind:
                        event.target
                          .value as
                          CaseTargetKind,
                    }),
                  );
                }}
              >
                {Object.entries(
                  TARGET_LABELS,
                ).map(
                  ([
                    kind,
                    label,
                  ]) => (
                    <option
                      key={kind}
                      value={kind}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="caseField">
              <span>Valor do alvo</span>

              <input
                maxLength={2048}
                value={
                  draft.targetValue
                }
                placeholder="example.com"
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      targetValue:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>

            <label className="caseField">
              <span>Identificação</span>

              <input
                maxLength={120}
                value={
                  draft.targetLabel
                }
                placeholder="Domínio principal"
                onChange={(event) => {
                  setDraft(
                    (current) => ({
                      ...current,
                      targetLabel:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>
          </div>

          <footer>
            <span>
              Novos perfis são selecionados
              automaticamente.
            </span>

            <button
              className="primaryButton"
              type="submit"
              disabled={mutating}
            >
              {mutating
                ? 'Criando...'
                : 'Criar perfil'}
            </button>
          </footer>
        </form>
      )}

      {loading &&
      summaries.length === 0 ? (
        <div className="caseLoading">
          Carregando perfis...
        </div>
      ) : (
        <div className="casesWorkspace">
          <aside className="casesDirectory">
            <header>
              <div>
                <span>
                  CASE DIRECTORY
                </span>

                <strong>
                  {filteredSummaries.length}
                </strong>
              </div>

              <input
                type="search"
                value={query}
                placeholder="Buscar perfil..."
                aria-label="Buscar perfil"
                onChange={(event) => {
                  setQuery(
                    event.target.value,
                  );
                }}
              />
            </header>

            <div className="casesList">
              {filteredSummaries.map(
                (summary) => {
                  const selected =
                    activeCase?.id ===
                    summary.id;

                  return (
                    <button
                      className={`caseListItem ${
                        selected
                          ? 'active'
                          : ''
                      }`}
                      type="button"
                      key={summary.id}
                      disabled={mutating}
                      onClick={() => {
                        selectCase(
                          summary.id,
                        ).catch(
                          (
                            unknownError,
                          ) => {
                            console.error(
                              'Não foi possível selecionar o perfil.',
                              unknownError,
                            );
                          },
                        );
                      }}
                    >
                      <div className="caseListItemTop">
                        <span>
                          {summary.name
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>

                        <i
                          data-status={
                            summary.status
                          }
                        >
                          {
                            STATUS_LABELS[
                              summary.status
                            ]
                          }
                        </i>
                      </div>

                      <strong>
                        {summary.name}
                      </strong>

                      <p>
                        {summary.description ||
                          'Sem descrição.'}
                      </p>

                      <footer>
                        <span>
                          {summary.targetCount}
                          {' '}
                          alvos
                        </span>

                        <span>
                          {summary.activityCount}
                          {' '}
                          eventos
                        </span>

                        <time>
                          {formatDate(
                            summary.updatedAt,
                          )}
                        </time>
                      </footer>
                    </button>
                  );
                },
              )}

              {filteredSummaries.length ===
                0 && (
                <div className="caseDirectoryEmpty">
                  Nenhum perfil encontrado.
                </div>
              )}
            </div>
          </aside>

          <section className="caseDetail">
            {!activeCase ? (
              <div className="caseEmptyState">
                <span>CASE</span>

                <h2>
                  Nenhum perfil ativo
                </h2>

                <p>
                  Crie ou selecione um perfil
                  para começar uma investigação
                  organizada.
                </p>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => {
                    setCreating(true);
                  }}
                >
                  Criar primeiro perfil
                </button>
              </div>
            ) : (
              <>
                <header className="caseDetailHeader">
                  <div>
                    <span>
                      ACTIVE CASE
                    </span>

                    <h2>
                      {activeCase.name}
                    </h2>

                    <p>
                      {activeCase.description ||
                        'Perfil sem descrição.'}
                    </p>
                  </div>

                  <div className="caseIdentity">
                    <span>
                      {activeCase.id
                        .slice(0, 8)
                        .toUpperCase()}
                    </span>

                    <small>
                      Atualizado
                      {' '}
                      {formatDate(
                        activeCase.updatedAt,
                      )}
                    </small>
                  </div>
                </header>

                <div className="caseStatusStrip">
                  {(
                    [
                      'active',
                      'paused',
                      'archived',
                    ] as const
                  ).map(
                    (status) => (
                      <button
                        className={
                          activeCase.status ===
                          status
                            ? 'active'
                            : ''
                        }
                        type="button"
                        key={status}
                        disabled={mutating}
                        onClick={() => {
                          updateStatus(
                            activeCase.id,
                            status,
                          ).catch(
                            (
                              unknownError,
                            ) => {
                              console.error(
                                'Não foi possível alterar o status.',
                                unknownError,
                              );
                            },
                          );
                        }}
                      >
                        {
                          STATUS_LABELS[
                            status
                          ]
                        }
                      </button>
                    ),
                  )}
                </div>

                <CaseProfileEditor
                  key={`profile-${activeCase.id}`}
                  caseData={activeCase}
                />

                <div className="caseSummaryGrid">
                  <article>
                    <span>ALVOS</span>
                    <strong>
                      {
                        activeCase
                          .targets
                          .length
                      }
                    </strong>
                  </article>

                  <article>
                    <span>EVENTOS</span>
                    <strong>
                      {
                        activeCase
                          .activities
                          .length
                      }
                    </strong>
                  </article>

                  <article>
                    <span>CRIADO</span>
                    <strong>
                      {formatDate(
                        activeCase.createdAt,
                      )}
                    </strong>
                  </article>
                </div>

                <CaseTargetManager
                  key={`targets-${activeCase.id}`}
                  caseData={activeCase}
                />

                <form
                  className="caseManualNote"
                  onSubmit={(event) => {
                    handleAddNote(event)
                      .catch(
                        (
                          unknownError,
                        ) => {
                          console.error(
                            'Falha inesperada ao salvar nota.',
                            unknownError,
                          );
                        },
                      );
                  }}
                >
                  <header>
                    <div>
                      <span>
                        MANUAL ENTRY
                      </span>

                      <h3>
                        Adicionar à timeline
                      </h3>
                    </div>

                    <small>
                      Nota persistente
                    </small>
                  </header>

                  <input
                    required
                    maxLength={180}
                    value={noteTitle}
                    placeholder="Título da observação"
                    onChange={(event) => {
                      setNoteTitle(
                        event.target.value,
                      );
                    }}
                  />

                  <textarea
                    required
                    maxLength={4000}
                    value={noteBody}
                    placeholder="Observações, hipóteses, próximos passos ou contexto da investigação..."
                    onChange={(event) => {
                      setNoteBody(
                        event.target.value,
                      );
                    }}
                  />

                  <footer>
                    <span>
                      A nota será registrada com
                      data e hora.
                    </span>

                    <button
                      className="primaryButton"
                      type="submit"
                      disabled={mutating}
                    >
                      Registrar nota
                    </button>
                  </footer>
                </form>

                <section className="caseSection">
                  <header>
                    <div>
                      <span>
                        TIMELINE
                      </span>

                      <h3>
                        Histórico da investigação
                      </h3>
                    </div>

                    <small>
                      {
                        activeCase
                          .activities
                          .length
                      }
                    </small>
                  </header>

                  <div className="caseTimeline">
                    {activeCase
                      .activities
                      .map(
                        (
                          activity,
                        ) => (
                          <article
                            className="caseTimelineItem"
                            key={
                              activity.id
                            }
                          >
                            <div className="caseTimelineRail">
                              <span
                                data-status={
                                  activity.status
                                }
                              />
                            </div>

                            <div className="caseTimelineContent">
                              <header>
                                <div>
                                  <span>
                                    {
                                      activity.moduleId
                                    }
                                    {' / '}
                                    {
                                      activity.action
                                    }
                                  </span>

                                  <strong>
                                    {
                                      activity.title
                                    }
                                  </strong>
                                </div>

                                <time>
                                  {formatDate(
                                    activity.createdAt,
                                  )}
                                </time>
                              </header>

                              {activity.note && (
                                <p>
                                  {
                                    activity.note
                                  }
                                </p>
                              )}

                              {(activity.input !==
                                null ||
                                activity.output !==
                                  null) && (
                                <details className="casePayload">
                                  <summary>
                                    Dados estruturados
                                  </summary>

                                  {activity.input !==
                                    null && (
                                    <div>
                                      <span>
                                        INPUT
                                      </span>

                                      <pre>
                                        {stringifyValue(
                                          activity.input,
                                        )}
                                      </pre>
                                    </div>
                                  )}

                                  {activity.output !==
                                    null && (
                                    <div>
                                      <span>
                                        OUTPUT
                                      </span>

                                      <pre>
                                        {stringifyValue(
                                          activity.output,
                                        )}
                                      </pre>
                                    </div>
                                  )}
                                </details>
                              )}
                            </div>
                          </article>
                        ),
                      )}

                    {activeCase.activities
                      .length === 0 && (
                      <div className="caseSectionEmpty">
                        A timeline está vazia.
                        Registre uma nota ou
                        execute uma ferramenta
                        integrada futuramente.
                      </div>
                    )}
                  </div>
                </section>

                <div className="caseRoadmapNote">
                  <span>
                    NEXT
                  </span>

                  <p>
                    A próxima integração conectará
                    automaticamente resultados dos
                    módulos a esta timeline e
                    adicionará exportação/importação.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
