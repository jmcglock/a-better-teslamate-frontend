import Link from "next/link";

export default function EmptyState({
  title,
  detail,
  icon = "○",
  action,
}: {
  title: string;
  detail?: string;
  icon?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>{icon}</div>
      <p className="font-[family-name:var(--font-cond)] text-base font-semibold tracking-tight">{title}</p>
      {detail && <p className="max-w-sm text-sm text-ink-2">{detail}</p>}
      {action && (
        <Link href={action.href} className="pressable mt-1 rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:text-ink">
          {action.label}
        </Link>
      )}
    </div>
  );
}
