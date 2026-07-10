type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <>
      <header className="pageHeader">
        <div>
          <span className="eyebrow">
            ZEROHUB MODULE
          </span>

          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <span className="plannedBadge">
          Planejado
        </span>
      </header>

      <section className="emptyState">
        <div className="emptyStateIcon">◇</div>

        <h2>Módulo em desenvolvimento</h2>

        <p>
          Essa categoria será implementada nas
          próximas etapas do ZeroHub.
        </p>
      </section>
    </>
  );
}
