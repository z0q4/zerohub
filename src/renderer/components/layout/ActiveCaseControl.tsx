import {
  useCaseWorkspace,
} from '../../features/cases/CaseWorkspaceContext';

type ActiveCaseControlProps = {
  onOpenCases(): void;
};

export function ActiveCaseControl({
  onOpenCases,
}: ActiveCaseControlProps) {
  const {
    summaries,
    activeCase,
    loading,
    mutating,
    error,
    selectCase,
  } = useCaseWorkspace();

  return (
    <div
      className={`activeCaseControl ${
        activeCase
          ? 'hasActiveCase'
          : ''
      }`}
      title={
        error ??
        (
          activeCase
            ? `Perfil ativo: ${activeCase.name}`
            : 'Nenhum perfil de alvo ativo'
        )
      }
    >
      <span
        className="activeCaseIndicator"
        aria-hidden="true"
      />

      <label>
        <small>
          TARGET PROFILE
        </small>

        <select
          value={
            activeCase?.id ?? ''
          }
          disabled={
            loading ||
            mutating
          }
          aria-label="Perfil do alvo ativo"
          onChange={(event) => {
            const nextId =
              event.target.value ||
              null;

            selectCase(nextId)
              .catch(
                (unknownError) => {
                  console.error(
                    'Não foi possível selecionar o perfil.',
                    unknownError,
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
              </option>
            ),
          )}
        </select>
      </label>

      <button
        type="button"
        title="Abrir Perfis do alvo"
        onClick={onOpenCases}
      >
        Abrir
      </button>
    </div>
  );
}
