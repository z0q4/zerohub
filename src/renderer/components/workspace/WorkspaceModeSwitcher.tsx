import type {
  WorkspaceMode,
} from '../../../shared/modules/module.types';

type WorkspaceModeSwitcherProps = {
  mode: WorkspaceMode;

  onChange(
    mode: WorkspaceMode,
  ): void;
};

const MODE_OPTIONS: readonly {
  id: WorkspaceMode;
  label: string;
}[] = [
  {
    id: 'osint',
    label: 'OSINT',
  },
  {
    id: 'attack',
    label: 'ATTACK',
  },
];

export function WorkspaceModeSwitcher({
  mode,
  onChange,
}: WorkspaceModeSwitcherProps) {
  return (
    <div
      className="workspaceModeSwitcher"
      role="group"
      aria-label="Modo do workspace"
    >
      {MODE_OPTIONS.map(
        (option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={
              mode === option.id
            }
            onClick={() => {
              onChange(option.id);
            }}
          >
            {option.label}
          </button>
        ),
      )}
    </div>
  );
}
