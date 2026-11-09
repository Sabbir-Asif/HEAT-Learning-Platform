import { BellIcon } from "lucide-react";
import { buttonVariants } from "../components/button";
import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { capCount } from "./nav";
import type { ShellLink } from "./types";

interface NotificationsLinkProps {
  href: string;
  count?: number;
  link?: ShellLink;
  className?: string;
}

function NotificationsLink({ href, count = 0, link, className }: NotificationsLinkProps) {
  const text = capCount(count);
  return linkElement(link, {
    href,
    "data-slot": "notifications-link",
    "aria-label": text ? `Notifications, ${text} unread` : "Notifications",
    className: cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative", className),
    children: (
      <>
        <BellIcon aria-hidden="true" />
        {text ? (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none"
          >
            {text}
          </span>
        ) : null}
      </>
    ),
  });
}

export { NotificationsLink };
export type { NotificationsLinkProps };
