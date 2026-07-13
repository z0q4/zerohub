import {
  useState,
  type FormEvent,
} from 'react';

import type {
  InvestigationCase,
} from '../../../../shared/cases/cases.types';

import {
  useCaseWorkspace,
} from '../CaseWorkspaceContext';

type CaseProfileEditorProps = {
  caseData: InvestigationCase;
};

type ProfileDraft = {
  name: string;
  description: string;
  tags: string;
};

function createDraft(
  caseData: InvestigationCase,
): ProfileDraft {
  return {
    name:
      caseData.name,
    description:
      caseData.description,
    tags:
      caseData.tags.join(', '),
  };
}

function parseTags(
  value: string,
): string[] {
  return value
    .split(',')
    .map(
      (tag) =>
        tag.trim(),
    )
    .filter(Boolean);
}

export function CaseProfileEditor({
  caseData,
}: CaseProfileEditorProps) {
  const {
    mutating,
    updateCase,
  } = useCaseWorkspace();

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    draft,
    setDraft,
  ] =
    useState<ProfileDraft>(
      createDraft(caseData),
    );

  const [
    localError,
    setLocalError,
  ] =
    useState<string | null>(
      null,
    );

  const normalizedTags =
    parseTags(draft.tags);

  const hasChanges =
    draft.name.trim() !==
      caseData.name ||
    draft.description.trim() !==
      caseData.description ||
    JSON.stringify(
      normalizedTags,
    ) !==
      JSON.stringify(
        caseData.tags,
      );

  function cancelEditing():
    void {
    setDraft(
      createDraft(caseData),
    );

    setLocalError(null);
    setEditing(false);
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLocalError(null);

    const name =
      draft.name.trim();

    if (!name) {
      setLocalError(
        'Informe um nome para o perfil.',
      );
      return;
    }

    try {
      const updated =
        await updateCase({
          caseId:
            caseData.id,
          name,
          description:
            draft.description.trim(),
          tags:
            normalizedTags,
        });

      setDraft(
        createDraft(updated),
      );

      setEditing(false);
    } catch (unknownError) {
      setLocalError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Não foi possível atualizar o perfil.',
      );
    }
  }

  return (
    <section className="caseSection caseProfileEditor">
      <header>
        <div>
          <span>
            PROFILE METADATA
          </span>

          <h3>
            Identidade do perfil
          </h3>
        </div>

        <div className="caseSectionHeaderActions">
          <small>
            {caseData.tags.length}
            {' tags'}
          </small>

          <button
            className="secondaryButton"
            type="button"
            disabled={mutating}
            onClick={() => {
              if (editing) {
                cancelEditing();
                return;
              }

              setDraft(
                createDraft(
                  caseData,
                ),
              );

              setLocalError(null);
              setEditing(true);
            }}
          >
            {editing
              ? 'Cancelar'
              : 'Editar perfil'}
          </button>
        </div>
      </header>

      {editing ? (
        <form
          className="caseProfileForm"
          onSubmit={(event) => {
            handleSubmit(event)
              .catch(
                (unknownError) => {
                  console.error(
                    'Falha inesperada ao editar perfil.',
                    unknownError,
                  );
                },
              );
          }}
        >
          <div className="caseFormGrid">
            <label className="caseField">
              <span>
                Nome do perfil
              </span>

              <input
                required
                maxLength={120}
                value={draft.name}
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

          {localError && (
            <div
              className="caseInlineError"
              role="alert"
            >
              {localError}
            </div>
          )}

          <footer className="caseProfileFormActions">
            <span>
              Alterações serão registradas
              automaticamente na timeline.
            </span>

            <div>
              <button
                className="secondaryButton"
                type="button"
                disabled={mutating}
                onClick={
                  cancelEditing
                }
              >
                Cancelar
              </button>

              <button
                className="primaryButton"
                type="submit"
                disabled={
                  mutating ||
                  !hasChanges
                }
              >
                {mutating
                  ? 'Salvando...'
                  : 'Salvar perfil'}
              </button>
            </div>
          </footer>
        </form>
      ) : (
        <div className="caseProfileOverview">
          <div>
            <span>
              DESCRIÇÃO
            </span>

            <p>
              {caseData.description ||
                'Perfil sem descrição.'}
            </p>
          </div>

          <div>
            <span>TAGS</span>

            <div className="caseProfileTags">
              {caseData.tags.map(
                (tag) => (
                  <span
                    className="caseTag"
                    key={tag}
                  >
                    {tag}
                  </span>
                ),
              )}

              {caseData.tags.length ===
                0 && (
                <span className="caseTag muted">
                  Sem tags
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
