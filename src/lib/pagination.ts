export const HISTORY_PAGE_SIZE = 50;

export type PageInfo = {
  /** 1-based index of the first row on this page; 0 when the page is empty. */
  first: number;
  /** 1-based index of the last row on this page; 0 when the page is empty. */
  last: number;
  total: number;
  totalPages: number;
  /** True when the requested page is beyond the last page of a non-empty list. */
  pastEnd: boolean;
};

/** Row range and page count for a paginated history list. */
export function pageInfo(page: number, pageSize: number, total: number, itemsOnPage: number): PageInfo {
  const safeTotal = Math.max(0, Math.trunc(total));
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize);
  const first = itemsOnPage > 0 ? (page - 1) * pageSize + 1 : 0;
  const last = itemsOnPage > 0 ? first + itemsOnPage - 1 : 0;
  return {
    first,
    last,
    total: safeTotal,
    totalPages,
    pastEnd: itemsOnPage === 0 && page > 1,
  };
}

/** "51–100 of 312" style label, or null when there is nothing to show. */
export function pageRangeLabel(info: PageInfo, noun: string): string | null {
  if (info.first === 0) return null;
  // Totals can lag the list by a cache window; never show "of" a smaller number.
  const total = Math.max(info.total, info.last);
  return `${info.first.toLocaleString("en-US")}–${info.last.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${noun}`;
}
