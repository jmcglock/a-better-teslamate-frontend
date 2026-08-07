export default function EmptyState({
  title,
  detail,
  icon = "○",
}: {
  title: string;
  detail?: string;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>{icon}</div>
      <p className="font-[family-name:var(--font-cond)] text-base font-semibold tracking-tight">{title}</p>
      {detail && <p className="max-w-sm text-sm text-ink-2">{detail}</p>}
    </div>
  );
}
