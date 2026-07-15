import type {
  RefObject,
} from 'react';

import type {
  InvestigationCase,
} from '../../../shared/cases/cases.types';

type TopRightControlsProps = {
  activeCase: InvestigationCase | null;
  modulePanelOpen: boolean;
  modulesButtonRef:
    RefObject<HTMLButtonElement | null>;

  onOpenCases(): void;

  onOpenSettings(): void;

  onRecenterMap(): void;

  onToggleModulePanel(): void;
};

export function TopRightControls({
  activeCase,
  modulePanelOpen,
  modulesButtonRef,
  onOpenCases,
  onOpenSettings,
  onRecenterMap,
  onToggleModulePanel,
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
        ref={modulesButtonRef}
        className="topRightModules"
        id="workspace-modules-trigger"
        type="button"
        aria-controls="workspace-module-panel"
        aria-expanded={modulePanelOpen}
        aria-label={
          modulePanelOpen
            ? 'Recolher painel de módulos'
            : 'Expandir painel de módulos'
        }
        title={
          modulePanelOpen
            ? 'Recolher módulos'
            : 'Expandir módulos'
        }
        onClick={onToggleModulePanel}
      >
        <span aria-hidden="true">
          □
        </span>
        <strong>Módulos</strong>
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
