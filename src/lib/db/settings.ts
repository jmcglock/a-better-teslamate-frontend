import { q } from "./pool";

export type Settings = {
  unitOfLength: "km" | "mi";
  unitOfTemperature: "C" | "F";
  preferredRange: "ideal" | "rated";
};

type Row = { unit_of_length: string | null; unit_of_temperature: string | null; preferred_range: string | null };

export async function getSettings(): Promise<Settings> {
  const rows = await q<Row>("SELECT unit_of_length, unit_of_temperature, preferred_range FROM settings LIMIT 1");
  const r = rows[0];
  return {
    unitOfLength: r?.unit_of_length === "mi" ? "mi" : "km",
    unitOfTemperature: r?.unit_of_temperature === "F" ? "F" : "C",
    preferredRange: r?.preferred_range === "ideal" ? "ideal" : "rated",
  };
}
