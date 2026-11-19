import { cn } from "../lib/utils";

type PageSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  id: string;
  title: string;
  description?: string;
};

function PageSection({ id, title, description, className, children, ...props }: PageSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="page-section"
      className="scroll-mt-20"
      {...props}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 md:px-6 md:py-16",
          className,
        )}
      >
        <header className="flex max-w-2xl flex-col gap-3">
          <span aria-hidden="true" className="bg-primary h-1 w-10 rounded-full" />
          <h2
            id={headingId}
            className="font-display text-heading-1 tracking-tight text-balance md:text-4xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-body-lg text-muted-foreground text-pretty">{description}</p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}

export { PageSection };
export type { PageSectionProps };
