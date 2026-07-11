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

export default function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "var(--state-idle)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {STATE_LABEL[state] ?? state}
    </span>
  );
}
