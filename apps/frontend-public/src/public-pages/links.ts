export const enrollHref = (courseSlug: string): string =>
  `/enroll?course=${encodeURIComponent(courseSlug)}`;

export const courseHref = (courseSlug: string): string =>
  `/courses/${encodeURIComponent(courseSlug)}`;

export const descriptionParagraphs = (description: string | null): string[] =>
  (description ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

export const newsHref = (slug: string): string => `/news/${encodeURIComponent(slug)}`;

export const newsPageHref = (page: number): string => (page <= 1 ? "/news" : `/news?page=${page}`);

export const newsPageFromParam = (value: string | string[] | undefined): number => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : 1;
};

const dhakaDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Asia/Dhaka",
});

export const formatNewsDate = (iso: string): string => dhakaDate.format(new Date(iso));

export const contactLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
