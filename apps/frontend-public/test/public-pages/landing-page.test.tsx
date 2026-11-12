import type { PublicFrontPageResponse, PublicLandingOverviewResponse } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { LandingPage } from "../../src/public-pages/landing-page";
import { mount } from "../learn/mount";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const id = (suffix: string) => `0198f1a0-0000-7000-8000-00000000000${suffix}`;

const overview = (
  overrides: Partial<PublicLandingOverviewResponse> = {},
): PublicLandingOverviewResponse => ({
  heading: "Gender safety at the University of Dhaka",
  schemaVersion: 1,
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Welcome." }] }],
  },
  imageAssetId: null,
  image: null,
  images: [],
  ...overrides,
});

const frontPage = (overrides: Partial<PublicFrontPageResponse> = {}): PublicFrontPageResponse => ({
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
  modules: [{ id: id("3"), title: "Boundaries", courseSlug: "heat", courseTitle: "HEAT" }],
  ...overrides,
});

const hrefs = (view: HTMLElement, text: string) =>
  [...view.querySelectorAll("a")]
    .filter((anchor) => anchor.textContent?.includes(text))
    .map((anchor) => anchor.getAttribute("href"));

describe("LandingPage", () => {
  test("shows the overview heading and text above the courses", async () => {
    const view = await mount(<LandingPage overview={overview()} frontPage={frontPage()} />);

    expect(view.querySelector("h1")?.textContent).toBe("Gender safety at the University of Dhaka");
    expect(view.textContent).toContain("Welcome.");
  });

  test("lists the courses in the given order with an Enroll deep link each", async () => {
    const view = await mount(<LandingPage overview={overview()} frontPage={frontPage()} />);

    const titles = [...view.querySelectorAll('[data-slot="card-title"]')].map(
      (node) => node.textContent,
    );
    expect(titles.slice(0, 2)).toEqual(["HEAT", "Consent"]);
    expect(hrefs(view, "Enroll")).toEqual([
      "/enroll?course=heat",
      "/enroll?course=consent",
      "/enroll?course=heat",
    ]);
    expect(hrefs(view, "View course")).toEqual(["/courses/heat", "/courses/consent"]);
  });

  test("renders a course thumbnail only when the course has one", async () => {
    const view = await mount(<LandingPage overview={overview()} frontPage={frontPage()} />);

    const images = [...view.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("alt")).toBe("Consent cover");
  });

  test("shows the shared empty state for courses and no modules section when none are tagged", async () => {
    const view = await mount(
      <LandingPage overview={overview()} frontPage={{ courses: [], modules: [] }} />,
    );

    expect(view.querySelector("h1")).not.toBeNull();
    expect(view.querySelector('[data-slot="empty-state"]')?.textContent).toContain(
      "No courses yet",
    );
    expect(view.textContent).not.toContain("Modules");
  });

  test("shows the overview image when one is set", async () => {
    const image = { assetId: id("8"), url: "/media/public/b/w1280.webp", alt: "Campus" };
    const view = await mount(
      <LandingPage overview={overview({ image })} frontPage={{ courses: [], modules: [] }} />,
    );

    expect(view.querySelector("img")?.getAttribute("alt")).toBe("Campus");
  });
});
