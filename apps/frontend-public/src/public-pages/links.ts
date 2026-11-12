export const enrollHref = (courseSlug: string): string =>
  `/enroll?course=${encodeURIComponent(courseSlug)}`;

export const courseHref = (courseSlug: string): string =>
  `/courses/${encodeURIComponent(courseSlug)}`;

export const descriptionParagraphs = (description: string | null): string[] =>
  (description ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
