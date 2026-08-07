/** Remounts on navigation so page-enter runs each route change. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
