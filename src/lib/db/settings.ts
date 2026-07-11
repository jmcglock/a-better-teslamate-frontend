import { q } from "./pool";

export type Settings = {
  unitOfLength: "km" | "mi";
  unitOfTemperature: "C" | "F";
  unitOfPressure: "bar" | "psi";
  preferredRange: "ideal" | "rated";
};

type Row = {
  unit_of_length: string | null;
  unit_of_temperature: string | null;
  unit_of_pressure: string | null;
  preferred_range: string | null;
};

export async function getSettings(): Promise<Settings> {
  const rows = await q<Row>(
    "SELECT unit_of_length, unit_of_temperature, unit_of_pressure, preferred_range FROM settings LIMIT 1",
  );
  const r = rows[0];
  return {
    unitOfLength: r?.unit_of_length === "mi" ? "mi" : "km",
    unitOfTemperature: r?.unit_of_temperature === "F" ? "F" : "C",
    unitOfPressure: r?.unit_of_pressure === "psi" ? "psi" : "bar",
    preferredRange: r?.preferred_range === "ideal" ? "ideal" : "rated",
  };
}
