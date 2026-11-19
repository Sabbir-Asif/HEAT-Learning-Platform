import type { PublicFrontPageResponse } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { LandingPage } from "../../src/public-pages/landing-page";
import { mount } from "../learn/mount";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("../../src/auth/use-student-session", () => ({
  useStudentSession: () => ({ kind: "anonymous" }),
}));

const id = (suffix: string) => `0198f1a0-0000-7000-8000-00000000000${suffix}`;

const frontPage = (overrides: Partial<PublicFrontPageResponse> = {}): PublicFrontPageResponse => ({
  modules: [],
  courses: [
    {
      id: id("1"),
      slug: "heat",
      title: "HEAT",
      description: "About HEAT",
      thumbnailAssetId: null,
      thumbnail: null,
    },
    {
      id: id("2"),
      slug: "consent",
      title: "Consent",
      description: null,
      thumbnailAssetId: id("9"),
      thumbnail: { assetId: id("9"), url: "/media/public/a/w640.webp", alt: "Consent cover" },
    },
  ],
  ...overrides,
});

const hrefs = (view: HTMLElement, text: string) =>
  [...view.querySelectorAll("a")]
    .filter((anchor) => anchor.textContent?.includes(text))
    .map((anchor) => anchor.getAttribute("href"));

describe("LandingPage", () => {
  test("opens with the hero banner image, the project title and a start action", async () => {
    const view = await mount(<LandingPage frontPage={frontPage()} />);

    expect(view.querySelector("h1")?.textContent).toContain("gender-based violence");
    expect(view.querySelector("img")?.getAttribute("src")).toBe("/hero/campus-gathering.jpg");
    expect(hrefs(view, "Start training")).toEqual(["/enroll"]);
    expect(hrefs(view, "Explore courses")).toEqual(["/#courses"]);
  });

  test("shows the four feature tiles and the about section on the same page", async () => {
    const view = await mount(<LandingPage frontPage={frontPage()} />);

    expect(view.querySelectorAll('[data-slot="feature-tile"]')).toHaveLength(4);
    expect(view.querySelector("#about")?.textContent).toContain("PIN 13019");
    expect(view.querySelector("#courses")).not.toBeNull();
  });

  test("lists the courses in the given order with an Enroll deep link each", async () => {
    const view = await mount(<LandingPage frontPage={frontPage()} />);

    const titles = [...view.querySelectorAll('[data-slot="card-title"]')].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(["HEAT", "Consent"]);
    expect(hrefs(view, "Enroll")).toEqual(["/enroll?course=heat", "/enroll?course=consent"]);
    expect(hrefs(view, "View course")).toEqual(["/courses/heat", "/courses/consent"]);
  });

  test("renders a course thumbnail only when the course has one", async () => {
    const view = await mount(<LandingPage frontPage={frontPage()} />);

    const alts = [...view.querySelectorAll("img")].map((image) => image.getAttribute("alt"));
    expect(alts).toContain("Consent cover");
    expect(alts.filter((alt) => alt?.includes("cover"))).toHaveLength(1);
  });

  test("shows the shared empty state when no course is published", async () => {
    const view = await mount(<LandingPage frontPage={{ courses: [], modules: [] }} />);

    expect(view.querySelector('[data-slot="empty-state"]')?.textContent).toContain(
      "No courses yet",
    );
  });
});
