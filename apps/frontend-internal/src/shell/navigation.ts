import { visibleGroups, type NavGroup } from "@heat/ui/shell";
import {
  BarChart3Icon,
  BookOpenIcon,
  Building2Icon,
  FileTextIcon,
  FilmIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  NetworkIcon,
  NewspaperIcon,
  ScrollTextIcon,
  ShieldIcon,
  TagIcon,
  UserCogIcon,
  UserCheckIcon,
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
      label: "Site content",
      items: [
        { href: "/content/resources", label: "Resources", icon: FileTextIcon },
        { href: "/content/news", label: "News", icon: NewspaperIcon },
        { href: "/content/pages", label: "Pages", icon: LayoutTemplateIcon },
        { href: "/content/tags", label: "Tags", icon: TagIcon },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admins", label: "Admins", icon: ShieldIcon, hidden: !isSuperAdmin },
        { href: "/audit-log", label: "Audit log", icon: ScrollTextIcon },
        { href: "/account", label: "Account", icon: UserCogIcon },
      ],
    },
  ]);
}
