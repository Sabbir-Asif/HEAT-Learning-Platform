import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  hidden?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  const path = cleanPath(pathname);
  if (href === "/" || exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function findActiveHref(
  items: ReadonlyArray<{ href: string; exact?: boolean }>,
  pathname: string,
): string | undefined {
  return items
    .filter((item) => isActivePath(pathname, item.href, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function visibleGroups(groups: ReadonlyArray<NavGroup>): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length > 0);
}

export function capCount(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word)[0] ?? "");
  const first = letters[0] ?? "";
  const last = letters.length > 1 ? (letters[letters.length - 1] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
