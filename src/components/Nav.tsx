"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { activeHref, groups, vehicle } from "@/lib/nav";

const pill = "pressable shrink-0 rounded-full px-3 py-1.5 text-sm";
const activePill =
  "bg-accent text-white shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent)]";
const idlePill = "text-ink-2 hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openGroup && !mobileOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup, mobileOpen]);

  return (
    <header
      className={`site-header sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-xl ${
        scrolled ? "is-scrolled" : ""
      }`}
    >
      <nav ref={navRef} className="relative mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" prefetch={false} className="pressable mr-3 flex shrink-0 items-center gap-2.5 leading-tight">
          <img src="/logo.png" alt="" width={32} height={32} className="brand-logo h-8 w-8 shrink-0" />
          <span className="hidden flex-col sm:flex">
            <span className="font-[family-name:var(--font-cond)] text-sm font-semibold tracking-[0.14em] text-ink">
              A BETTER TESLAMATE
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-2">Dashboard</span>
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          <Link
            href={vehicle.href}
            prefetch={false}
            className={`${pill} ${current === vehicle.href ? activePill : idlePill}`}
            aria-current={current === vehicle.href ? "page" : undefined}
          >
            {vehicle.label}
          </Link>
          {groups.map((group) => {
            const groupActive = group.links.some((l) => l.href === current);
            const open = openGroup === group.label;
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-haspopup="menu"
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  className={`${pill} inline-flex items-center gap-1.5 ${groupActive ? activePill : idlePill}`}
                >
                  {group.label}
                  <Chevron open={open} />
                </button>
                {open && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                  >
                    {group.links.map(({ href, label }) => {
                      const active = href === current;
                      return (
                        <Link
                          key={href}
                          href={href}
                          prefetch={false}
                          role="menuitem"
                          aria-current={active ? "page" : undefined}
                          className={`pressable block rounded-xl px-3 py-2 text-sm ${
                            active ? "bg-accent text-white" : idlePill
                          }`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className={`${pill} ml-auto inline-flex items-center gap-2 md:hidden ${idlePill}`}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            {mobileOpen ? (
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="round" />
            ) : (
              <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
            )}
          </svg>
          Menu
        </button>

        {mobileOpen && (
          <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-panel px-4 pb-5 pt-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)] md:hidden">
            <Link
              href={vehicle.href}
              prefetch={false}
              className={`pressable mb-3 block rounded-xl px-3 py-2 text-sm ${
                current === vehicle.href ? "bg-accent text-white" : idlePill
              }`}
            >
              {vehicle.label}
            </Link>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.22em] text-ink-2">{group.label}</div>
                  {group.links.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      aria-current={href === current ? "page" : undefined}
                      className={`pressable block rounded-xl px-3 py-2 text-sm ${
                        href === current ? "bg-accent text-white" : idlePill
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
