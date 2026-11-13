"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Vehicle" },
  { href: "/drives", label: "Drives" },
  { href: "/routes", label: "Routes" },
  { href: "/calendar", label: "Calendar" },
  { href: "/charges", label: "Charges" },
  { href: "/costs", label: "Costs" },
  { href: "/charge-lab", label: "Charge lab" },
  { href: "/energy", label: "Energy" },
  { href: "/usage", label: "Usage" },
  { href: "/stats", label: "Stats" },
  { href: "/efficiency", label: "Efficiency" },
  { href: "/battery", label: "Battery" },
  { href: "/stress", label: "Stress" },
  { href: "/timeline", label: "Timeline" },
  { href: "/places", label: "Places" },
  { href: "/updates", label: "Updates" },
];

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`site-header sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-xl ${
        scrolled ? "is-scrolled" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" prefetch={false} className="pressable mr-3 flex shrink-0 items-center gap-2.5 leading-tight">
          <img
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="brand-logo h-8 w-8 shrink-0"
          />
          <span className="hidden flex-col sm:flex">
            <span className="font-[family-name:var(--font-cond)] text-sm font-semibold tracking-[0.14em] text-ink">
              A BETTER TESLAMATE
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-2">Dashboard</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto sm:gap-1.5">
          {links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={`pressable shrink-0 rounded-full px-2.5 py-1.5 text-sm sm:px-3 ${
                  active
                    ? "bg-accent text-white shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent)]"
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
