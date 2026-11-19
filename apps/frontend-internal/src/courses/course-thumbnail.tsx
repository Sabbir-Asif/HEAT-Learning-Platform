import { cn } from "@heat/ui";
import { BookOpenIcon } from "lucide-react";
import Image from "next/image";

type CourseThumbnailProps = {
  title: string;
  thumbnail: { url: string; alt: string } | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

export function CourseThumbnail({
  title,
  thumbnail,
  sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw",
  priority = false,
  className,
}: CourseThumbnailProps) {
  return (
    <div
      className={cn(
        "bg-accent relative aspect-video w-full overflow-hidden",
        thumbnail === null &&
          "from-primary/90 to-sidebar text-primary-foreground grid place-items-center bg-linear-to-br",
        className,
      )}
    >
      {thumbnail === null ? (
        <>
          <span
            aria-hidden="true"
            className="bg-sidebar-primary/30 absolute -top-10 -right-10 size-40 rounded-full blur-2xl"
          />
          <BookOpenIcon aria-hidden="true" className="relative size-10 opacity-90" />
          <span className="sr-only">No thumbnail for {title}</span>
        </>
      ) : (
        <Image
          src={thumbnail.url}
          alt={thumbnail.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      )}
    </div>
  );
}
