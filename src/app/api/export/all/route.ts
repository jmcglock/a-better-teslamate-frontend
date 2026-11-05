import { listCharges } from "@/lib/db/charges";
import { listDrives } from "@/lib/db/drives";
import { safe } from "@/lib/db/pool";
import { listCarIdentities } from "@/lib/db/stats";
import { buildAllExport } from "@/lib/exportAll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const carsRes = await safe(listCarIdentities());
  if (!carsRes.ok) return unavailable(carsRes.error);
  const exported = await safe(buildAllExport(new URL(req.url), {
    knownCarIds: carsRes.data.map((car) => car.id),
    listDrives,
    listCharges,
  }));
  if (!exported.ok) return unavailable(exported.error);
  return exported.data;
}

function unavailable(error: string) {
  return Response.json(
    { error },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
