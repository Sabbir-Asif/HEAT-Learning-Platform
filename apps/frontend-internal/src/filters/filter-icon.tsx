import {
  BookOpenIcon,
  Building2Icon,
  CalendarIcon,
  CalendarRangeIcon,
  CircleDotIcon,
  GraduationCapIcon,
  LandmarkIcon,
  MailIcon,
  ShapesIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  Course: <BookOpenIcon />,
  University: <LandmarkIcon />,
  Faculty: <Building2Icon />,
  Department: <GraduationCapIcon />,
  Session: <CalendarRangeIcon />,
  Status: <CircleDotIcon />,
  From: <CalendarIcon />,
  To: <CalendarIcon />,
  Actor: <UserIcon />,
  Action: <ZapIcon />,
  Entity: <ShapesIcon />,
  Email: <MailIcon />,
};

export function filterIcon(label: string): ReactNode {
  return icons[label] ?? null;
}
