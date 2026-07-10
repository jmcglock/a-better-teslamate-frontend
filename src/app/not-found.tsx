import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="font-medium">Page not found</p>
      <p className="mt-1 text-sm text-ink-2">
        The drive or charge you’re looking for doesn’t exist. <Link href="/" className="underline">Back to the dashboard</Link>.
      </p>
    </div>
  );
}
