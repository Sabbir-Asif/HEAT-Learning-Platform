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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-14 pb-8 md:px-6 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="flex max-w-sm flex-col gap-4">
            <p className="font-display text-heading-2 leading-tight font-semibold">{brand.name}</p>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {brand.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-4">
                <p className="text-xs font-semibold tracking-widest uppercase">{column.title}</p>
                <ul className="flex flex-col gap-3">
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
          className="border-border/60 flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs font-semibold tracking-widest uppercase">In partnership with</p>
          <ul className="flex flex-wrap items-center gap-x-10 gap-y-4">
            {partners.map((partner) => (
              <li key={partner.src} className="opacity-80 transition-opacity hover:opacity-100">
                <ThemedLogo {...partner} className="h-9" />
              </li>
            ))}
          </ul>
        </section>
        <div className="border-border/60 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">{copyright}</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
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
