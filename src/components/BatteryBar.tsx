export default function BatteryBar({
  soc, state, chargeLimit,
}: { soc: number | null; state: string; chargeLimit?: number | null }) {
  const pct = soc ?? 0;
  return (
    <div
      className="battery-bar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={soc ?? undefined}
      aria-label={soc === null ? "Battery level unknown" : `Battery ${pct}%`}
    >
      <div className="battery-bar-fill" data-state={state} style={{ width: `${pct}%` }} />
      {chargeLimit != null && chargeLimit > 0 && chargeLimit < 100 && (
        <div aria-hidden className="battery-bar-limit" style={{ left: `${chargeLimit}%` }} />
      )}
    </div>
  );
}
