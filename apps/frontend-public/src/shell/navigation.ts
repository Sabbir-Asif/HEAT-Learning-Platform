import type { FooterColumn, FooterLink, NavItem } from "@heat/ui/shell";
import {
  AwardIcon,
  BookOpenIcon,
  HomeIcon,
  InfoIcon,
  LayersIcon,
  LayoutDashboardIcon,
  UserIcon,
} from "lucide-react";

export const publicNavigation: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/#about", label: "About", icon: InfoIcon },
  { href: "/#courses", label: "Courses", icon: LayersIcon },
];

export const learnerNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/learn", label: "My Learning", icon: BookOpenIcon },
  { href: "/certificates", label: "Certificates", icon: AwardIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Learn",
    links: [
      { href: "/#courses", label: "Courses" },
      { href: "/verify", label: "Verify a certificate" },
    ],
  },
  {
    title: "About",
    links: [{ href: "/#about", label: "About the project" }],
  },
  {
    title: "Contact",
    links: [{ href: "mailto:support@heat.du.ac.bd", label: "support@heat.du.ac.bd" }],
  },
];

export const legalLinks: FooterLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/accessibility", label: "Accessibility" },
];
