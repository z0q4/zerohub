type ModuleWorkspaceHeaderProps = {
  abbreviation: string;
  badge: string;
  capabilities: readonly string[];
  description: string;
  privacy: string;
  section: string;
  title: string;
  workflow: readonly string[];
};

export function ModuleWorkspaceHeader({
  abbreviation,
  badge,
  capabilities,
  description,
  privacy,
  section,
  title,
  workflow,
}: ModuleWorkspaceHeaderProps) {
  function openWorkspace(): void {
    document
      .querySelector(
        '.moduleWorkspace .toolPanel',
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  }

  return (
    <header className="moduleWorkspaceHeader">
      <div className="moduleWorkspaceHeaderMain">
        <div className="moduleWorkspaceIdentity">
          <div className="moduleWorkspaceEyebrow">
            <span />
            ZEROHUB
            <i>/</i>
            {section}
          </div>

          <h1>{title}</h1>

          <p>{description}</p>

          <div className="moduleWorkspaceChips">
            {capabilities.map(
              (capability) => (
                <span key={capability}>
                  {capability}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="moduleWorkspaceHeaderVisual">
          <div className="moduleWorkspaceRadar">
            <span />
            <span />
            <span />

            <strong>
              {abbreviation}
            </strong>
          </div>

          <div className="moduleWorkspaceHeaderStatus">
            <span>
              {badge}
            </span>

            <strong>
              Operational
            </strong>

            <small>
              {privacy}
            </small>
          </div>
        </div>
      </div>

      <div className="moduleWorkspaceCommandStrip">
        <div className="moduleWorkspaceWorkflow">
          {workflow.map(
            (
              step,
              index,
            ) => (
              <div key={step}>
                <span>
                  {String(
                    index + 1,
                  ).padStart(
                    2,
                    '0',
                  )}
                </span>

                <strong>
                  {step}
                </strong>
              </div>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={openWorkspace}
        >
          Open Workspace
          <span aria-hidden="true">
            ↓
          </span>
        </button>
      </div>
    </header>
  );
}

