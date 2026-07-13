import type {
  WorkspaceMode,
} from '../../../shared/modules/module.types';

type WorkspaceSearchProps = {
  commandHint: string;
  mode: WorkspaceMode;

  onOpen(): void;
};

export function WorkspaceSearch({
  commandHint,
  mode,
  onOpen,
}: WorkspaceSearchProps) {
  return (
    <button
      className="workspaceSearch"
      type="button"
      onClick={onOpen}
    >
      <span aria-hidden="true">
        ⌕
      </span>

      <strong>
        {mode === 'osint'
          ? 'Buscar ferramenta, alvo ou domínio'
          : 'Buscar ferramenta ou operação'}
      </strong>

      <kbd>{commandHint}</kbd>
    </button>
  );
}
