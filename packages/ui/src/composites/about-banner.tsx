import { cn } from "../lib/utils";

type AboutBannerProps = Omit<React.ComponentProps<"section">, "title"> & {
  id: string;
  title: string;
  image: React.ReactNode;
};

function AboutBanner({ id, title, image, className, children, ...props }: AboutBannerProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="about-banner"
      className={cn("mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-12 md:px-6 md:py-16", className)}
      {...props}
    >
      <div className="bg-secondary ring-divider grid items-center overflow-hidden rounded-xl ring-1 md:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <h2 id={headingId} className="font-display text-heading-1 tracking-tight md:text-4xl">
            {title}
          </h2>
          <div className="text-body-lg text-secondary-foreground flex max-w-prose flex-col gap-3 text-pretty">
            {children}
          </div>
        </div>
        <div className="relative aspect-3/2 w-full [&_img]:object-cover [&_img]:mix-blend-multiply">
          {image}
          <div
            aria-hidden="true"
            className="from-secondary absolute inset-y-0 left-0 w-1/4 bg-linear-to-r to-transparent max-md:hidden"
          />
        </div>
      </div>
    </section>
  );
}

export { AboutBanner };
export type { AboutBannerProps };
