import { courseSlugMaxLength } from "@heat/contracts";

export const slugFromTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, courseSlugMaxLength)
    .replace(/-+$/, "");
