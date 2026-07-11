export default function BatteryBar({
  soc, state, chargeLimit,
}: { soc: number | null; state: string; chargeLimit?: number | null }) {
  const pct = soc ?? 0;
  // role="meter" requires aria-valuenow, so only claim the role when we have a value.
  const meterProps =
    soc === null
      ? { "aria-label": "Battery level unknown" }
      : {
          role: "meter" as const,
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": soc,
          "aria-label": `Battery ${pct}%`,
        };
  return (
    <div className="battery-bar" {...meterProps}>
      <div className="battery-bar-fill" data-state={state} style={{ width: `${pct}%` }} />
      {chargeLimit != null && chargeLimit > 0 && chargeLimit < 100 && (
        <div aria-hidden className="battery-bar-limit" style={{ left: `${chargeLimit}%` }} />
      )}
    </div>
  );
}
