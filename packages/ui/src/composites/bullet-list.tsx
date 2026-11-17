import { cn } from "../lib/utils";

function BulletList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="bullet-list"
      className={cn("flex list-disc flex-col gap-1 ps-5", className)}
      {...props}
    />
  );
}

export { BulletList };
