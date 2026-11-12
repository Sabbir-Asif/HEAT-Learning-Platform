import type { PublicCourseResponse } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { CourseOverview } from "../../src/public-pages/course-overview";
import { mount } from "../learn/mount";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const id = (suffix: string) => `0198f1a0-0000-7000-8000-00000000000${suffix}`;

const course = (overrides: Partial<PublicCourseResponse> = {}): PublicCourseResponse => ({
  id: id("1"),
  slug: "heat",
  title: "HEAT Gender Safety",
  description: "First paragraph.\n\nSecond paragraph.",
  thumbnail: null,
  modules: [
    { id: id("2"), order: 1, title: "Consent", objectives: ["Define consent"] },
    { id: id("3"), order: 2, title: "Reporting", objectives: [] },
  ],
  ...overrides,
});

describe("CourseOverview", () => {
  test("shows the title, the description paragraphs and the modules in order", async () => {
    const view = await mount(<CourseOverview course={course()} />);

    expect(view.querySelector("h1")?.textContent).toBe("HEAT Gender Safety");
    expect(view.querySelectorAll("p")).toHaveLength(2);
    const titles = [...view.querySelectorAll('[data-slot="card-title"]')].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(["1. Consent", "2. Reporting"]);
    expect(view.textContent).toContain("Define consent");
  });

  test("sends the Enroll button to the enroll page with the course slug", async () => {
    const view = await mount(<CourseOverview course={course()} />);

    const enroll = [...view.querySelectorAll("a")].find((anchor) =>
      anchor.textContent?.includes("Enroll"),
    );
    expect(enroll?.getAttribute("href")).toBe("/enroll?course=heat");
  });

  test("shows the thumbnail when there is one and an empty state without modules", async () => {
    const thumbnail = { assetId: id("9"), url: "/media/public/a/w1280.webp", alt: "Cover" };
    const view = await mount(<CourseOverview course={course({ thumbnail, modules: [] })} />);

    expect(view.querySelector("img")?.getAttribute("alt")).toBe("Cover");
    expect(view.querySelector('[data-slot="empty-state"]')?.textContent).toContain(
      "No modules yet",
    );
  });
});
