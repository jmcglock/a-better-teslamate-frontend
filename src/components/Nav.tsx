"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/drives", label: "Drives" },
  { href: "/charges", label: "Charges" },
  { href: "/stats", label: "Stats" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-panel">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-[family-name:var(--font-mono)] text-sm font-medium tracking-widest text-ink">
          TESLAMATE
        </span>
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active ? "bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
