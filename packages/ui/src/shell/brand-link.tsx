import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { ThemedLogo } from "./themed-logo";
import type { LogoSource, ShellLink } from "./types";

interface BrandLinkProps {
  name: string;
  href: string;
  logo: LogoSource;
  link?: ShellLink;
  className?: string;
}

function BrandLink({ name, href, logo, link, className }: BrandLinkProps) {
  return linkElement(link, {
    href,
    className: cn(
      "focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md outline-hidden focus-visible:ring-2",
      className,
    ),
    children: (
      <>
        <ThemedLogo {...logo} eager className="h-9" />
        <span className="font-display truncate text-base font-semibold">{name}</span>
      </>
    ),
  });
}

export { BrandLink };
export type { BrandLinkProps };
