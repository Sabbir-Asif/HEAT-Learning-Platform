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
  brand: { name: string; description: string };
  columns: ReadonlyArray<FooterColumn>;
  partners: ReadonlyArray<LogoSource>;
  legal: ReadonlyArray<FooterLink>;
  copyright: string;
  link?: ShellLink;
}

const footerLink =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm underline-offset-4 outline-hidden hover:underline focus-visible:ring-2";

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
    <footer data-slot="public-footer" className="bg-secondary text-secondary-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex max-w-md flex-col gap-3">
            <p className="font-display text-heading-2">{brand.name}</p>
            <p className="text-muted-foreground text-sm text-pretty">{brand.description}</p>
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
          className="bg-card ring-divider flex flex-col gap-4 rounded-xl px-6 py-5 ring-1 sm:flex-row sm:items-center sm:gap-8"
        >
          <p className="text-muted-foreground text-sm font-semibold">In partnership with</p>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {partners.map((partner) => (
              <li key={partner.src}>
                <ThemedLogo {...partner} className="h-10" />
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">{copyright}</p>
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
