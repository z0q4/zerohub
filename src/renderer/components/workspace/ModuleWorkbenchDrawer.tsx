import type {
  ReactNode,
} from 'react';

import type {
  ModuleDefinition,
} from '../../../shared/modules/module.types';

type ModuleWorkbenchDrawerProps = {
  children: ReactNode;
  module: ModuleDefinition;

  onClose(): void;
};

export function ModuleWorkbenchDrawer({
  children,
  module,
  onClose,
}: ModuleWorkbenchDrawerProps) {
  return (
    <aside
      className="moduleWorkbenchDrawer"
      aria-label={`${module.name} workspace`}
    >
      <header className="moduleWorkbenchHeader">
        <div>
          <span>
            {module.abbreviation}
            {' / '}
            {module.status}
          </span>

          <h1>{module.name}</h1>

          <p>{module.description}</p>
        </div>

        <button
          type="button"
          aria-label="Fechar módulo"
          title="Fechar módulo"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="moduleWorkbenchBody">
        {children}
      </div>
    </aside>
  );
}
