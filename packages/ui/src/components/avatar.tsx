import * as React from "react";
import { cn } from "../lib/utils";

type AvatarProps = Omit<React.ComponentProps<"span">, "children"> & {
  src?: string | null;
  name: string;
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

function Avatar({ src, name, className, ...props }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "bg-muted text-muted-foreground relative inline-flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-medium",
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={`Profile picture of ${name}`} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}

export { Avatar, initialsOf };
export type { AvatarProps };
