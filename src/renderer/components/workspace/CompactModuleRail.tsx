import type {
  ModuleDefinition,
} from '../../../shared/modules/module.types';

import type {
  PageId,
} from '../../app/types';

type CompactModuleRailProps = {
  activePage: PageId;
  modules: ModuleDefinition[];

  onNavigate(
    page: PageId,
  ): void;
};

function RailButton({
  active,
  label,
  description,
  symbol,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  symbol: string;

  onClick(): void;
}) {
  return (
    <button
      className={`compactRailButton ${
        active ? 'active' : ''
      }`}
      type="button"
      aria-label={`${label}: ${description}`}
      title={`${label} — ${description}`}
      onClick={onClick}
    >
      <span aria-hidden="true">
        {symbol}
      </span>
    </button>
  );
}

export function CompactModuleRail({
  activePage,
  modules,
  onNavigate,
}: CompactModuleRailProps) {
  return (
    <nav
      className="compactModuleRail"
      aria-label="Navegação do workspace"
    >
      <div className="compactRailBrand">
        Z
      </div>

      <RailButton
        active={activePage === 'dashboard'}
        label="Mapa"
        description="Voltar para o canvas geoespacial"
        symbol="⌂"
        onClick={() => {
          onNavigate('dashboard');
        }}
      />

      <div className="compactRailDivider" />

      <div className="compactRailModules">
        {modules.map((module) => (
          <RailButton
            key={module.id}
            active={
              activePage === module.id
            }
            label={module.name}
            description={
              module.description
            }
            symbol={
              module.abbreviation.slice(
                0,
                2,
              )
            }
            onClick={() => {
              onNavigate(module.id);
            }}
          />
        ))}
      </div>

      <div className="compactRailBottom">
        <RailButton
          active={activePage === 'cases'}
          label="Perfis do alvo"
          description="Cases e alvos de investigação"
          symbol="CA"
          onClick={() => {
            onNavigate('cases');
          }}
        />

        <RailButton
          active={
            activePage === 'settings'
          }
          label="Settings"
          description="Preferências do ZeroHub"
          symbol="ST"
          onClick={() => {
            onNavigate('settings');
          }}
        />
      </div>
    </nav>
  );
}
