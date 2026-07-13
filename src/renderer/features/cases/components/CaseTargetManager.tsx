import {
  useState,
  type FormEvent,
} from 'react';

import type {
  CaseTargetKind,
  InvestigationCase,
} from '../../../../shared/cases/cases.types';

import {
  useCaseWorkspace,
} from '../CaseWorkspaceContext';

import {
  TARGET_LABELS,
  TARGET_PLACEHOLDERS,
} from '../cases.constants';

type CaseTargetManagerProps = {
  caseData: InvestigationCase;
};

type TargetDraft = {
  kind: CaseTargetKind;
  value: string;
  label: string;
};

const EMPTY_TARGET_DRAFT:
  TargetDraft = {
    kind: 'domain',
    value: '',
    label: '',
  };

export function CaseTargetManager({
  caseData,
}: CaseTargetManagerProps) {
  const {
    mutating,
    addTarget,
    removeTarget,
    setPrimaryTarget,
  } = useCaseWorkspace();

  const [
    adding,
    setAdding,
  ] = useState(
    caseData.targets.length === 0,
  );

  const [
    draft,
    setDraft,
  ] =
    useState<TargetDraft>({
      ...EMPTY_TARGET_DRAFT,
    });

  const [
    confirmRemoveTargetId,
    setConfirmRemoveTargetId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    localError,
    setLocalError,
  ] =
    useState<string | null>(
      null,
    );

  function closeComposer():
    void {
    setDraft({
      ...EMPTY_TARGET_DRAFT,
    });

    setLocalError(null);
    setAdding(false);
  }

  async function handleAddTarget(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLocalError(null);

    const value =
      draft.value.trim();

    if (!value) {
      setLocalError(
        'Informe o valor do alvo.',
      );
      return;
    }

    try {
      await addTarget({
        caseId:
          caseData.id,
        target: {
          kind:
            draft.kind,
          value,
          label:
            draft.label.trim(),
        },
      });

      closeComposer();
    } catch (unknownError) {
      setLocalError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível adicionar o alvo.',
      );
    }
  }

  async function handleSetPrimary(
    targetId: string,
  ): Promise<void> {
    setLocalError(null);

    try {
      await setPrimaryTarget({
        caseId:
          caseData.id,
        targetId,
      });
    } catch (unknownError) {
      setLocalError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível definir o alvo principal.',
      );
    }
  }

  async function handleRemove(
    targetId: string,
  ): Promise<void> {
    setLocalError(null);

    try {
      await removeTarget({
        caseId:
          caseData.id,
        targetId,
      });

      setConfirmRemoveTargetId(
        null,
      );
    } catch (unknownError) {
      setLocalError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível remover o alvo.',
      );
    }
  }

  return (
    <section className="caseSection caseTargetManager">
      <header>
        <div>
          <span>TARGETS</span>

          <h3>
            Alvos vinculados
          </h3>
        </div>

        <div className="caseSectionHeaderActions">
          <small>
            {caseData.targets.length}
          </small>

          <button
            className="secondaryButton"
            type="button"
            disabled={mutating}
            onClick={() => {
              if (adding) {
                closeComposer();
                return;
              }

              setLocalError(null);
              setAdding(true);
            }}
          >
            {adding
              ? 'Fechar'
              : 'Adicionar alvo'}
          </button>
        </div>
      </header>

      {adding && (
        <form
          className="caseTargetComposer caseTargetComposerInline"
          onSubmit={(event) => {
            handleAddTarget(event)
              .catch(
                (unknownError) => {
                  console.error(
                    'Falha inesperada ao adicionar alvo.',
                    unknownError,
                  );
                },
              );
          }}
        >
          <label className="caseField">
            <span>Tipo do alvo</span>

            <select
              value={draft.kind}
              onChange={(event) => {
                setDraft(
                  (current) => ({
                    ...current,
                    kind:
                      event.target
                        .value as
                        CaseTargetKind,
                    value: '',
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
              required
              maxLength={4096}
              value={draft.value}
              placeholder={
                TARGET_PLACEHOLDERS[
                  draft.kind
                ]
              }
              onChange={(event) => {
                setDraft(
                  (current) => ({
                    ...current,
                    value:
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
              value={draft.label}
              placeholder="Nome opcional"
              onChange={(event) => {
                setDraft(
                  (current) => ({
                    ...current,
                    label:
                      event.target.value,
                  }),
                );
              }}
            />
          </label>

          <button
            className="primaryButton"
            type="submit"
            disabled={mutating}
          >
            {mutating
              ? 'Adicionando...'
              : 'Adicionar'}
          </button>
        </form>
      )}

      {localError && (
        <div
          className="caseInlineError"
          role="alert"
        >
          {localError}
        </div>
      )}

      <div className="caseTargets">
        {caseData.targets.map(
          (
            target,
            index,
          ) => {
            const isPrimary =
              index === 0;

            const confirmingRemoval =
              confirmRemoveTargetId ===
              target.id;

            return (
              <article
                className={`caseTargetCard ${
                  isPrimary
                    ? 'isPrimary'
                    : ''
                }`}
                key={target.id}
              >
                <div className="caseTargetCardHeader">
                  <span>
                    {
                      TARGET_LABELS[
                        target.kind
                      ]
                    }
                  </span>

                  {isPrimary && (
                    <em>
                      Principal
                    </em>
                  )}
                </div>

                <strong>
                  {target.label}
                </strong>

                <code>
                  {target.value}
                </code>

                <footer className="caseTargetActions">
                  {!isPrimary && (
                    <button
                      className="caseMiniButton"
                      type="button"
                      disabled={mutating}
                      onClick={() => {
                        handleSetPrimary(
                          target.id,
                        ).catch(
                          (unknownError) => {
                            console.error(
                              'Falha inesperada ao definir alvo principal.',
                              unknownError,
                            );
                          },
                        );
                      }}
                    >
                      Tornar principal
                    </button>
                  )}

                  {confirmingRemoval ? (
                    <div className="caseTargetConfirm">
                      <span>
                        Remover?
                      </span>

                      <button
                        className="caseMiniButton danger"
                        type="button"
                        disabled={mutating}
                        onClick={() => {
                          handleRemove(
                            target.id,
                          ).catch(
                            (unknownError) => {
                              console.error(
                                'Falha inesperada ao remover alvo.',
                                unknownError,
                              );
                            },
                          );
                        }}
                      >
                        Confirmar
                      </button>

                      <button
                        className="caseMiniButton"
                        type="button"
                        disabled={mutating}
                        onClick={() => {
                          setConfirmRemoveTargetId(
                            null,
                          );
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="caseMiniButton danger"
                      type="button"
                      disabled={mutating}
                      onClick={() => {
                        setConfirmRemoveTargetId(
                          target.id,
                        );
                      }}
                    >
                      Remover
                    </button>
                  )}
                </footer>
              </article>
            );
          },
        )}

        {caseData.targets.length ===
          0 && (
          <div className="caseSectionEmpty">
            Nenhum alvo vinculado.
          </div>
        )}
      </div>
    </section>
  );
}
