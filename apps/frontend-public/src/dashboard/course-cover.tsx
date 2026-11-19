import type { LessonBodyImage } from "@heat/contracts";
import { cn } from "@heat/ui";
import { BookOpenIcon } from "lucide-react";
import Image from "next/image";

interface CourseCoverProps {
  thumbnail: LessonBodyImage | null;
  sizes: string;
  className?: string;
  priority?: boolean;
}

export function CourseCover({ thumbnail, sizes, className, priority = false }: CourseCoverProps) {
  return (
    <div
      className={cn(
        "bg-accent relative overflow-hidden",
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
