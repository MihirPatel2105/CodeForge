/** The site's page groups, shared by the top bar's dropdowns and the phone menu. */
export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  id: string;
  label: string;
  /** Two columns once a group has more links than fit comfortably in one. */
  columns: 1 | 2;
  links: readonly NavLink[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "product",
    label: "Product",
    columns: 2,
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/#team-title", label: "The five agents" },
      { href: "/#how", label: "The build, step by step" },
      { href: "/#repair-loop", label: "The repair loop" },
      { href: "/faq", label: "Questions" },
    ],
  },
  {
    id: "demos",
    label: "Demos",
    columns: 1,
    links: [
      { href: "/demo/library", label: "Personal Library" },
      { href: "/demo/inventory", label: "Inventory Control" },
      { href: "/demo/support", label: "Support Desk" },
    ],
  },
  {
    id: "company",
    label: "Company",
    columns: 1,
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/** A group is "current" when the page being viewed is one of its links (anchors on / excluded). */
export function groupIsCurrent(group: NavGroup, pathname: string): boolean {
  return group.links.some((link) => !link.href.includes("#") && pathname.startsWith(link.href));
}
