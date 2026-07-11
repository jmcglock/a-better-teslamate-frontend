"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Vehicle" },
  { href: "/drives", label: "Drives" },
  { href: "/charges", label: "Charges" },
  { href: "/stats", label: "Stats" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="mr-3 flex min-w-0 flex-col leading-tight">
          <span className="truncate font-[family-name:var(--font-cond)] text-sm font-semibold tracking-[0.14em] text-ink">
            A BETTER TESLAMATE
          </span>
          <span className="truncate text-[10px] uppercase tracking-[0.22em] text-ink-2">Dashboard</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:gap-1.5">
          {links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "text-ink-2 hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
