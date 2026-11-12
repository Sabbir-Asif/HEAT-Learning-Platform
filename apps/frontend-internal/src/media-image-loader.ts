import { mediaImageUrl } from "@heat/contracts";

export default function mediaImageLoader({ src, width }: { src: string; width: number }): string {
  return mediaImageUrl(src, width);
}
