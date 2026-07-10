import {
  getDashboardModules,
  getOperationalModules,
} from '../../shared/modules/module.registry';

import type { PageId } from '../app/types';

type DashboardPageProps = {
  onNavigate(page: PageId): void;
};

export function DashboardPage({
  onNavigate,
}: DashboardPageProps) {
  const modules = getDashboardModules();

  const operationalModuleCount =
    getOperationalModules().filter(
      (module) =>
        module.showOnDashboard,
    ).length;

  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB WORKSPACE
          </span>

          <h1>Dashboard</h1>

          <p>
            Plataforma desktop modular para
            ferramentas técnicas.
          </p>
        </div>

        <span className="versionBadge">
          v0.1.0-dev
        </span>
      </header>

      <section className="modulesSection">
        <div className="sectionHeader">
          <div>
            <h2>Módulos</h2>

            <p>
              Selecione uma categoria para começar.
            </p>
          </div>

          <span>
            {operationalModuleCount}{' '}
            operacional
          </span>
        </div>

        <div className="moduleGrid">
          {modules.map((module) => {
            const isOperational =
              module.status === 'operational';

            return (
              <article
                className={`moduleCard ${
                  isOperational
                    ? 'moduleAvailable'
                    : ''
                }`}
                key={module.id}
              >
                <div className="moduleTop">
                  <div className="moduleIcon">
                    {module.abbreviation}
                  </div>

                  <span
                    className={`moduleStatus ${
                      isOperational
                        ? 'operational'
                        : ''
                    }`}
                  >
                    {isOperational
                      ? 'Operacional'
                      : 'Planejado'}
                  </span>
                </div>

                <div className="moduleContent">
                  <h3>{module.name}</h3>
                  <p>{module.description}</p>
                </div>

                <button
                  className="moduleButton"
                  type="button"
                  disabled={!isOperational}
                  onClick={() =>
                    onNavigate(module.id)
                  }
                >
                  {isOperational
                    ? 'Abrir módulo'
                    : 'Em breve'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
