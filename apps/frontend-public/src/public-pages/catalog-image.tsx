import type { LessonBodyImage } from "@heat/contracts";
import { ImageFrame } from "@heat/ui";
import Image from "next/image";

interface CatalogImageProps {
  image: LessonBodyImage;
  sizes: string;
  priority?: boolean;
  className?: string;
}

export function CatalogImage({ image, sizes, priority = false, className }: CatalogImageProps) {
  return (
    <ImageFrame className={className}>
      <Image src={image.url} alt={image.alt} fill sizes={sizes} priority={priority} />
    </ImageFrame>
  );
}
