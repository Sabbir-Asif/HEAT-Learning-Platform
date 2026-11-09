import type { FooterColumn, FooterLink, NavItem } from "@heat/ui/shell";
import {
  AwardIcon,
  BookOpenIcon,
  HomeIcon,
  InfoIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  MailIcon,
  NewspaperIcon,
  UserIcon,
} from "lucide-react";

export const publicNavigation: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/about", label: "About", icon: InfoIcon },
  { href: "/courses", label: "Training Modules", icon: LayersIcon },
  { href: "/resources", label: "Resources", icon: LibraryIcon },
  { href: "/news", label: "News", icon: NewspaperIcon },
  { href: "/contact", label: "Contact", icon: MailIcon },
];

export const learnerNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/learn", label: "My Learning", icon: BookOpenIcon },
  { href: "/certificates", label: "Certificates", icon: AwardIcon },
  { href: "/resources", label: "Resources", icon: LibraryIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "Training modules" },
      { href: "/resources", label: "Resources" },
      { href: "/news", label: "News" },
      { href: "/verify", label: "Verify a certificate" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About the course" },
      { href: "/contact", label: "Contact" },
    ],
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
