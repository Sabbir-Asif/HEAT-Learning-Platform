import { findActiveHref, type NavGroup } from "@heat/ui/shell";

export interface Crumb {
  label: string;
  href?: string;
}

const segmentLabels: Record<string, string> = {
  new: "New",
  edit: "Edit",
  preview: "Preview",
  modules: "Modules",
};

function cleanSegments(pathname: string): string[] {
  return pathname
    .replace(/[?#].*$/, "")
    .split("/")
    .filter(Boolean);
}

export function buildBreadcrumbs(pathname: string, groups: ReadonlyArray<NavGroup>): Crumb[] {
  const items = groups.flatMap((group) => group.items);
  const activeHref = findActiveHref(items, pathname);
  const item = items.find((candidate) => candidate.href === activeHref);
  if (!item) return [{ label: "Overview", href: "/" }];
  if (item.href === "/") return [{ label: "Overview" }];

  const group = groups.find((candidate) => candidate.items.includes(item));
  const rest = cleanSegments(pathname).slice(cleanSegments(item.href).length);
  const crumbs: Crumb[] = [{ label: "Overview", href: "/" }];
  if (group && group.label !== item.label) crumbs.push({ label: group.label });
  crumbs.push({ label: item.label, href: item.href });
  for (const segment of rest) {
    const label = segmentLabels[segment] ?? "Details";
    if (crumbs[crumbs.length - 1]?.label !== label) crumbs.push({ label });
  }
  return crumbs.map((crumb, index) =>
    index === crumbs.length - 1 ? { label: crumb.label } : crumb,
  );
}
