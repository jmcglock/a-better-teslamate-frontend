import Link from "next/link";

export default function FilterPills({
  options,
  active,
  hrefFor,
}: {
  options: readonly { key: string; label: string }[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = option.key === active;
        return (
          <Link
            key={option.key}
            href={hrefFor(option.key)}
            className={`pressable rounded-full px-3 py-1 text-sm ${
              on ? "bg-accent text-white" : "border border-line text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
