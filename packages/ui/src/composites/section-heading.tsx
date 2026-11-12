import { cn } from "../lib/utils";

function SectionHeading({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="section-heading"
      className={cn("font-heading text-lg font-semibold break-words", className)}
      {...props}
    />
  );
}

export { SectionHeading };
