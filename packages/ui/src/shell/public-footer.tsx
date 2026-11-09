import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { ThemedLogo } from "./themed-logo";
import type { LogoSource, ShellLink } from "./types";

interface FooterLink {
  href: string;
  label: string;
}

interface FooterColumn {
  title: string;
  links: ReadonlyArray<FooterLink>;
}

interface PublicFooterProps {
  brand: { name: string; description: string; logos: ReadonlyArray<LogoSource> };
  columns: ReadonlyArray<FooterColumn>;
  partners: ReadonlyArray<LogoSource>;
  legal: ReadonlyArray<FooterLink>;
  copyright: string;
  link?: ShellLink;
}

const footerLink =
  "text-sidebar-foreground focus-visible:ring-sidebar-ring rounded-sm text-sm underline-offset-4 outline-hidden hover:underline focus-visible:ring-2";

function PublicFooter({ brand, columns, partners, legal, copyright, link }: PublicFooterProps) {
  const renderLink = ({ href, label }: FooterLink) =>
    href.startsWith("mailto:") ? (
      <a href={href} className={footerLink}>
        {label}
      </a>
    ) : (
      linkElement(link, { href, className: footerLink, children: label })
    );

  return (
    <footer data-slot="public-footer" className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 md:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex max-w-md flex-col gap-3">
            <div className="flex items-center gap-2">
              {brand.logos.map((logo) => (
                <ThemedLogo key={logo.src} {...logo} tone="inverse" className="h-10" />
              ))}
            </div>
            <p className="font-display text-heading-3">{brand.name}</p>
            <p className="text-sm">{brand.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{column.title}</p>
                <ul className="flex flex-col gap-2">
                  {column.links.map((item) => (
                    <li key={item.href}>{renderLink(item)}</li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <section
          aria-label="Partners"
          className="border-sidebar-border flex flex-wrap items-center gap-x-6 gap-y-4 border-y py-6"
        >
          <p className="text-sm">In partnership with</p>
          <ul className="flex flex-wrap items-center gap-6">
            {partners.map((partner) => (
              <li key={partner.src}>
                <ThemedLogo {...partner} tone="inverse" className="h-10" />
              </li>
            ))}
          </ul>
        </section>
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}>
          <p className="text-sm">{copyright}</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {legal.map((item) => (
                <li key={item.href}>{renderLink(item)}</li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export { PublicFooter };
export type { FooterColumn, FooterLink, PublicFooterProps };
