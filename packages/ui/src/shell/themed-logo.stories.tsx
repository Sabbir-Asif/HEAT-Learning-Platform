import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { fixtureLogo } from "./fixtures";
import { ThemedLogo } from "./themed-logo";

const meta = {
  title: "Shell/ThemedLogo",
  component: ThemedLogo,
  tags: ["test"],
  args: fixtureLogo,
} satisfies Meta<typeof ThemedLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  globals: { theme: "light" },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByAltText("HEAT logo")[0]).toBeVisible();
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByAltText("HEAT logo")[1]).toBeVisible();
  },
};

export const Inverse: Story = { args: { tone: "inverse" } };
