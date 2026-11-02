import { historyHref } from "@/lib/db/range";

export default function ExportCsvLink({
  path,
  car,
  range,
}: {
  path: string;
  car: number | null;
  range: string;
}) {
  return (
    <a
      href={historyHref(path, { car, range })}
      className="pressable rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:text-ink"
    >
      Export CSV
    </a>
  );
}
