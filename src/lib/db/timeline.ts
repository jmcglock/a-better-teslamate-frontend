import { q } from "./pool";

export type StateRow = {
  id: number;
  state: string;
  start_date: Date;
  end_date: Date | null;
  car_name: string | null;
  car_id: number;
};

export type StateItem = {
  id: number;
  state: string;
  startDate: string;
  endDate: string | null;
  carName: string;
  carId: number;
  /** Duration in minutes when end is known; null if still open */
  durationMin: number | null;
};

export function mapStateRow(r: StateRow): StateItem {
  const start = r.start_date.getTime();
  const end = r.end_date ? r.end_date.getTime() : null;
  return {
    id: r.id,
    state: r.state,
    startDate: r.start_date.toISOString(),
    endDate: r.end_date ? r.end_date.toISOString() : null,
    carName: r.car_name ?? `Car ${r.car_id}`,
    carId: r.car_id,
    durationMin: end !== null ? Math.max(0, Math.round((end - start) / 60_000)) : null,
  };
}

export async function listStates(
  page: number,
  pageSize = 50,
  carId?: number | null,
): Promise<{ items: StateItem[]; hasMore: boolean }> {
  const params: unknown[] = [pageSize + 1, (page - 1) * pageSize];
  let where = "";
  if (carId != null) {
    where = "WHERE s.car_id = $3";
    params.push(carId);
  }
  const rows = await q<StateRow>(
    `
    SELECT s.id, s.state::text AS state, s.start_date, s.end_date, c.name AS car_name, s.car_id
    FROM states s
    JOIN cars c ON c.id = s.car_id
    ${where}
    ORDER BY s.start_date DESC
    LIMIT $1 OFFSET $2
    `,
    params,
  );
  return { items: rows.slice(0, pageSize).map(mapStateRow), hasMore: rows.length > pageSize };
}
