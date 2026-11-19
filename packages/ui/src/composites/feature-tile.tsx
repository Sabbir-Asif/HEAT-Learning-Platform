import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type FeatureTileProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon: LucideIcon;
  title: string;
  description: string;
};

function FeatureTile({ icon: Icon, title, description, className, ...props }: FeatureTileProps) {
  return (
    <div
      data-slot="feature-tile"
      className={cn(
        "bg-card text-card-foreground ring-divider flex h-full flex-col items-start gap-4 rounded-xl p-6 shadow-sm ring-1 transition-shadow hover:shadow-md",
        className,
      )}
      {...props}
    >
      <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-lg">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground -mt-2 text-sm leading-relaxed text-pretty">
        {description}
      </p>
    </div>
  );
}

export { FeatureTile };
export type { FeatureTileProps };

type FeatureGridProps = Omit<React.ComponentProps<"section">, "children"> & {
  tiles: ReadonlyArray<FeatureTileProps>;
};

function FeatureGrid({ tiles, className, ...props }: FeatureGridProps) {
  return (
    <section
      data-slot="feature-grid"
      className={cn(
        "relative z-10 mx-auto w-full max-w-7xl px-4 pt-8 md:-mt-12 md:px-6 md:pt-0",
        className,
      )}
      {...props}
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.title}>
            <FeatureTile {...tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export { FeatureGrid };
export type { FeatureGridProps };
