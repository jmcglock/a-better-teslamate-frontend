const STATE_COLOR: Record<string, string> = {
  charging: "var(--state-charging)",
  driving: "var(--state-driving)",
  updating: "var(--state-updating)",
  online: "var(--state-driving)",
};

const STATE_LABEL: Record<string, string> = {
  charging: "Charging",
  driving: "Driving",
  updating: "Updating",
  online: "Online",
  asleep: "Asleep",
  suspended: "Falling asleep",
  offline: "Offline",
};

const LIVE_STATES = new Set(["charging", "driving", "online", "updating"]);

export default function StateBadge({
  state,
  live = false,
}: {
  state: string;
  /** When true and state is active, show a soft breathing glow on the dot */
  live?: boolean;
}) {
  const color = STATE_COLOR[state] ?? "var(--state-idle)";
  const pulse = live && LIVE_STATES.has(state);
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-[border-color,background-color,color] duration-300"
      style={{
        borderColor: `color-mix(in oklab, ${color} 40%, var(--line))`,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
        color,
      }}
    >
      <span
        aria-hidden
        className={`state-dot ${pulse ? "is-live" : ""}`}
        style={{ background: color }}
      />
      {STATE_LABEL[state] ?? state}
    </span>
  );
}
