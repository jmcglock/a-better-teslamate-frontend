export default function DataUnavailable({ service, detail }: { service: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="font-medium">Can’t reach the TeslaMate {service}</p>
      <p className="mt-1 text-sm text-ink-2">
        {detail ?? "Check that the service is running and the connection settings are correct, then reload."}
      </p>
    </div>
  );
}
