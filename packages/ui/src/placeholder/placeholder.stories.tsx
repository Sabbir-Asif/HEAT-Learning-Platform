import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Placeholder } from "./placeholder";

// Story-local sample text. @heat/ui takes no i18n dependency; the apps translate their own copy.
const english = {
  heading: "Setup check",
  text: "Storybook runs with the theme, locale and accessibility checks.",
  actionLabel: "Continue",
};
const bangla = {
  heading: "সেটআপ পরীক্ষা",
  text: "স্টোরিবুক থিম, ভাষা এবং অ্যাক্সেসিবিলিটি পরীক্ষা সহ চলছে। সংখ্যা: ১২৩৪৫৬৭৮৯০",
  actionLabel: "চালিয়ে যান",
};

const meta = {
  title: "Placeholder",
  component: Placeholder,
  tags: ["test"],
  parameters: { a11y: { test: "error" } },
  args: english,
} satisfies Meta<typeof Placeholder>;

export default meta;
type Story = StoryObj<typeof meta>;

const lightForeground = "rgb(15, 23, 42)";
const darkForeground = "rgb(229, 231, 235)";
const fontFamily = "Noto Sans Bengali Variable";

export const LightEnglish: Story = {
  globals: { theme: "light", locale: "en" },
  play: async ({ canvasElement, canvas }) => {
    await expect(document.documentElement).not.toHaveClass("dark");
    await expect(canvasElement.closest(".dark")).toBeNull();
    await expect(document.documentElement).toHaveAttribute("lang", "en");
    await expect(getComputedStyle(canvas.getByRole("heading")).color).toBe(lightForeground);
  },
};

export const DarkEnglish: Story = {
  globals: { theme: "dark", locale: "en" },
  play: async ({ canvasElement, canvas }) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expect(canvasElement.querySelector(".dark")).not.toBeNull();
    await expect(getComputedStyle(canvas.getByRole("heading")).color).toBe(darkForeground);
  },
};

/** Bangla text must render in the self-hosted Bangla-capable family, with its face loaded. */
const expectBanglaFont: NonNullable<Story["play"]> = async ({ canvasElement, canvas }) => {
  await expect(document.documentElement).toHaveAttribute("lang", "bn");
  await expect(canvasElement.querySelector('[lang="bn"]')).not.toBeNull();
  const heading = canvas.getByRole("heading");
  await document.fonts.load(`16px "${fontFamily}"`, bangla.heading);
  await document.fonts.ready;
  const loaded = [...document.fonts].filter(
    (face) => face.family.replaceAll('"', "") === fontFamily && face.status === "loaded",
  );
  await expect(loaded.some((face) => face.unicodeRange.includes("U+980"))).toBe(true);
  await expect(getComputedStyle(heading).fontFamily).toContain(fontFamily);
};

export const LightBangla: Story = {
  args: bangla,
  globals: { theme: "light", locale: "bn" },
  play: expectBanglaFont,
};

export const DarkBangla: Story = {
  args: bangla,
  globals: { theme: "dark", locale: "bn" },
  play: async (context) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expectBanglaFont(context);
  },
};
