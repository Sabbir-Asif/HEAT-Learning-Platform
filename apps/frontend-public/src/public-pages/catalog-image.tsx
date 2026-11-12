import type { LessonBodyImage } from "@heat/contracts";
import Image from "next/image";

interface CatalogImageProps {
  image: LessonBodyImage;
  sizes: string;
  priority?: boolean;
}

export function CatalogImage({ image, sizes, priority = false }: CatalogImageProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg">
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
