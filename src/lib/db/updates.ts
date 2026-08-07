import { q } from "./pool";

export type UpdateRow = {
  id: number;
  version: string | null;
  start_date: Date;
  end_date: Date | null;
  car_name: string | null;
  car_id: number;
};

export type UpdateItem = {
  id: number;
  version: string;
  startDate: string;
  endDate: string | null;
  carName: string;
  carId: number;
  durationMin: number | null;
};

export function mapUpdateRow(r: UpdateRow): UpdateItem {
  const start = r.start_date.getTime();
  const end = r.end_date ? r.end_date.getTime() : null;
  return {
    id: r.id,
    version: r.version ?? "unknown",
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    carName: r.car_name ?? `Car ${r.car_id}`,
    carId: r.car_id,
    durationMin: end !== null ? Math.max(0, Math.round((end - start) / 60_000)) : null,
  };
}

export async function listUpdates(
  page: number,
  pageSize = 50,
): Promise<{ items: UpdateItem[]; hasMore: boolean }> {
  const rows = await q<UpdateRow>(
    `
    SELECT u.id, u.version, u.start_date, u.end_date, c.name AS car_name, u.car_id
    FROM updates u
    JOIN cars c ON c.id = u.car_id
    ORDER BY u.start_date DESC
    LIMIT $1 OFFSET $2
    `,
    [pageSize + 1, (page - 1) * pageSize],
  );
  return { items: rows.slice(0, pageSize).map(mapUpdateRow), hasMore: rows.length > pageSize };
}
