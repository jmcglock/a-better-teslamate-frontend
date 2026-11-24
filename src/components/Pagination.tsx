import Link from "next/link";

export default function Pagination({
  page,
  hasMore,
  label,
  hrefFor,
}: {
  page: number;
  hasMore: boolean;
  label: string | null;
  hrefFor: (page: number) => string;
}) {
  if (!label && page <= 1 && !hasMore) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {page > 1 && <Link className="pressable text-ink-2 hover:text-ink" href={hrefFor(page - 1)}>← Newer</Link>}
      {hasMore && <Link className="pressable text-ink-2 hover:text-ink" href={hrefFor(page + 1)}>Older →</Link>}
      {label && <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-ink-2">{label}</span>}
    </nav>
  );
}
