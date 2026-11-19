import { cn } from "../lib/utils";

type HeroBannerProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: string;
  description: string;
  badge?: string;
  actions?: React.ReactNode;
  image: React.ReactNode;
};

function HeroBanner({
  title,
  description,
  badge,
  actions,
  image,
  className,
  ...props
}: HeroBannerProps) {
  return (
    <section
      data-slot="hero-banner"
      className={cn("bg-secondary relative isolate flex flex-col overflow-hidden", className)}
      {...props}
    >
      <div
        data-slot="hero-banner-image"
        className="relative aspect-3/2 w-full max-md:order-last md:absolute md:inset-0 md:aspect-auto [&_img]:object-cover [&_img]:object-right"
      >
        {image}
      </div>
      <div
        aria-hidden="true"
        className="from-secondary via-secondary/60 absolute inset-0 bg-linear-to-r to-transparent max-md:hidden"
      />
      <div className="relative mx-auto flex w-full max-w-7xl px-4 py-10 md:min-h-152 md:items-center md:px-6 md:pt-20 md:pb-28">
        <div className="flex max-w-2xl flex-col items-start gap-5">
          {badge ? (
            <p className="bg-background/80 text-secondary-foreground ring-divider rounded-full px-3.5 py-1 text-sm font-semibold ring-1 backdrop-blur-sm">
              {badge}
            </p>
          ) : null}
          <h1 className="font-display text-secondary-foreground text-4xl leading-tight font-bold tracking-tight text-balance md:text-6xl">
            {title}
          </h1>
          <p className="text-body-lg text-secondary-foreground/80 max-w-xl text-pretty">
            {description}
          </p>
          {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

export { HeroBanner };
export type { HeroBannerProps };
