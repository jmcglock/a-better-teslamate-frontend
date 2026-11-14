export type NavLink = { href: string; label: string };
export type NavGroup = { label: string; links: NavLink[] };

export const vehicle: NavLink = { href: "/", label: "Vehicle" };

export const groups: NavGroup[] = [
  {
    label: "Driving",
    links: [
      { href: "/drives", label: "Drives" },
      { href: "/routes", label: "Routes" },
      { href: "/calendar", label: "Calendar" },
      { href: "/timeline", label: "Timeline" },
      { href: "/places", label: "Places" },
    ],
  },
  {
    label: "Charging",
    links: [
      { href: "/charges", label: "Charges" },
      { href: "/costs", label: "Costs" },
      { href: "/charge-lab", label: "Charge lab" },
      { href: "/energy", label: "Energy" },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/usage", label: "Usage" },
      { href: "/stats", label: "Stats" },
      { href: "/efficiency", label: "Efficiency" },
      { href: "/battery", label: "Battery" },
      { href: "/stress", label: "Stress" },
    ],
  },
  {
    label: "Software",
    links: [
      { href: "/updates", label: "Updates" },
      { href: "/updates/impact", label: "Update impact" },
    ],
  },
];

const allHrefs = [vehicle.href, ...groups.flatMap((g) => g.links.map((l) => l.href))];

/** Longest matching href wins, so /updates/impact does not also light up /updates. */
export function activeHref(pathname: string): string | null {
  if (pathname === "/") return "/";
  let best: string | null = null;
  for (const href of allHrefs) {
    if (href === "/") continue;
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}
