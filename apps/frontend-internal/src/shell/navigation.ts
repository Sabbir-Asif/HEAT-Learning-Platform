import { visibleGroups, type NavGroup } from "@heat/ui/shell";
import {
  BarChart3Icon,
  BookOpenIcon,
  Building2Icon,
  FilmIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  UserCogIcon,
  UserCheckIcon,
  UserPenIcon,
  UsersIcon,
} from "lucide-react";

export function adminNavigation(isSuperAdmin = true): NavGroup[] {
  return visibleGroups([
    {
      label: "Overview",
      items: [
        { href: "/", label: "Overview", icon: LayoutDashboardIcon },
        { href: "/insights", label: "Insights", icon: BarChart3Icon },
      ],
    },
    {
      label: "Students",
      items: [
        { href: "/enrollments", label: "Enrollments", icon: UserCheckIcon },
        { href: "/students", label: "Students", icon: UsersIcon },
        { href: "/profile-changes", label: "Profile changes", icon: UserPenIcon },
      ],
    },
    { label: "Courses", items: [{ href: "/courses", label: "Courses", icon: BookOpenIcon }] },
    { label: "Media", items: [{ href: "/videos", label: "Videos", icon: FilmIcon }] },
    {
      label: "Directory",
      items: [
        { href: "/directory/universities", label: "Universities", icon: LandmarkIcon },
        { href: "/directory/faculties", label: "Faculties", icon: Building2Icon },
        { href: "/directory/departments", label: "Departments", icon: NetworkIcon },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admins", label: "Admins", icon: ShieldIcon, hidden: !isSuperAdmin },
        { href: "/audit-log", label: "Audit log", icon: ScrollTextIcon, hidden: !isSuperAdmin },
        { href: "/settings", label: "Settings", icon: SettingsIcon },
        { href: "/account", label: "Account", icon: UserCogIcon },
      ],
    },
  ]);
}
