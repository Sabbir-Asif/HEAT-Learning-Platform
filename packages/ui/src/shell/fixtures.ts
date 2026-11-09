import { AwardIcon, BookOpenIcon, LayoutDashboardIcon, LibraryIcon, UserIcon } from "lucide-react";
import type { NavGroup, NavItem } from "./nav";
import type { LogoSource } from "./types";

const svg = (shape: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${shape}</svg>`)}`;

export const fixtureLogo: LogoSource = {
  src: svg('<rect width="64" height="64" rx="12"/>'),
  darkSrc: svg('<circle cx="32" cy="32" r="30"/>'),
  alt: "HEAT logo",
};

export const fixturePartners: LogoSource[] = [
  { ...fixtureLogo, alt: "Government of Bangladesh" },
  {
    ...fixtureLogo,
    src: svg('<rect width="64" height="64"/>'),
    alt: "University Grants Commission",
  },
  { ...fixtureLogo, src: svg('<rect width="48" height="64"/>'), alt: "World Bank" },
];

export const fixtureItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/learn", label: "My Learning", icon: BookOpenIcon },
  { href: "/certificates", label: "Certificates", icon: AwardIcon },
  { href: "/resources", label: "Resources", icon: LibraryIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export const fixtureGroups: NavGroup[] = [
  { label: "Learn", items: fixtureItems.slice(0, 3) },
  { label: "More", items: fixtureItems.slice(3) },
];
