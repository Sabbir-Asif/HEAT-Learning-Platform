import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Placeholder } from "./placeholder";

const meta = {
  title: "Placeholder",
  component: Placeholder,
  tags: ["test"],
  args: {
    heading: "Setup check",
    text: "Storybook runs with the theme and accessibility checks.",
    actionLabel: "Continue",
  },
} satisfies Meta<typeof Placeholder>;

export default meta;
type Story = StoryObj<typeof meta>;

const lightForeground = "rgb(15, 23, 42)";
const darkForeground = "rgb(229, 231, 235)";

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
  play: async ({ canvasElement, canvas }) => {
    await expect(document.documentElement).not.toHaveClass("dark");
    await expect(canvasElement.closest(".dark")).toBeNull();
    await expect(document.documentElement).toHaveAttribute("lang", "en");
    await expect(getComputedStyle(canvas.getByRole("heading")).color).toBe(lightForeground);
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvasElement, canvas }) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expect(canvasElement.querySelector(".dark")).not.toBeNull();
    await expect(getComputedStyle(canvas.getByRole("heading")).color).toBe(darkForeground);
  },
};
