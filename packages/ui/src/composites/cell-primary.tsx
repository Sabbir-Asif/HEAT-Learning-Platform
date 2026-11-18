import { cn } from "../lib/utils";

type CellPrimaryProps = Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
};

function CellPrimary({ title, description, className, ...props }: CellPrimaryProps) {
  return (
    <div data-slot="cell-primary" className={cn("flex min-w-0 flex-col", className)} {...props}>
      <span className="font-medium [&_a]:hover:underline">{title}</span>
      {description ? <span className="text-muted-foreground text-xs">{description}</span> : null}
    </div>
  );
}

export { CellPrimary };
export type { CellPrimaryProps };
