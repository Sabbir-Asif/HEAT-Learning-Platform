import { cn } from "../lib/utils";

function ImageFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="image-frame"
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg [&_img]:object-cover",
        className,
      )}
      {...props}
    />
  );
}

export { ImageFrame };
