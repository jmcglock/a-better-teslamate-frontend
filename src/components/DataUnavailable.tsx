export default function DataUnavailable({ service, detail }: { service: string; detail?: string }) {
  return (
    <div className="empty-state border-solid">
      <div className="empty-state-icon" aria-hidden>!</div>
      <p className="font-[family-name:var(--font-cond)] text-base font-semibold tracking-tight">
        Can’t reach the TeslaMate {service}
      </p>
      <p className="max-w-md text-sm text-ink-2">
        {detail ?? "Check that the service is running and the connection settings are correct, then reload."}
      </p>
    </div>
  );
}
