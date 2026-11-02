export type CsvCell = string | number | null;

const FORMULA_PREFIX = /^[=+\-@]/;
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * RFC 4180 CSV. String cells that start with = + - or @ are prefixed with a
 * single quote so a spreadsheet does not treat them as formulas. Numbers are
 * written as-is, including negatives.
 */
export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [
    headers.map((header) => quoteCsv(header)).join(","),
    ...rows.map((row) => row.map((cell) => formatDataCell(cell)).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function formatDataCell(cell: CsvCell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  return quoteCsv(guardFormula(cell));
}

function guardFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function quoteCsv(value: string): string {
  if (!NEEDS_QUOTES.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
