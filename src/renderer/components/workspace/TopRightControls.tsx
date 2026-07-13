import type {
  InvestigationCase,
} from '../../../shared/cases/cases.types';

type TopRightControlsProps = {
  activeCase: InvestigationCase | null;

  onOpenCases(): void;

  onOpenSettings(): void;

  onRecenterMap(): void;
};

export function TopRightControls({
  activeCase,
  onOpenCases,
  onOpenSettings,
  onRecenterMap,
}: TopRightControlsProps) {
  return (
    <div className="topRightControls">
      <button
        className="topRightCase"
        type="button"
        title="Abrir perfis do alvo"
        onClick={onOpenCases}
      >
        <span>
          {activeCase
            ? 'CASE'
            : 'NO CASE'}
        </span>
        <strong>
          {activeCase?.name ??
            'Sem case ativo'}
        </strong>
      </button>

      <button
        type="button"
        aria-label="Recentralizar mapa"
        title="Recentralizar mapa"
        onClick={onRecenterMap}
      >
        ⊙
      </button>

      <button
        type="button"
        aria-label="Abrir configurações"
        title="Configurações"
        onClick={onOpenSettings}
      >
        ST
      </button>
    </div>
  );
}
