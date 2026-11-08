import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { tokens } from "./token-data";
import { TokensPage } from "./tokens-page";

const meta = {
  title: "Foundations/Tokens",
  component: TokensPage,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TokensPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
  play: async ({ canvas }) => {
    await expect(document.documentElement).not.toHaveClass("dark");
    await expect(canvas.getAllByText(tokens.colors.light["primary"] ?? "")[0]).toBeVisible();
    await expect(canvas.getByText("sidebar-primary-foreground")).toBeVisible();
    await expect(canvas.getByText(/Source Serif 4, 700/)).toBeVisible();
  },
};

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveClass("dark");
    await expect(canvas.getAllByText(tokens.colors.dark["primary"] ?? "")[0]).toBeVisible();
    await expect(canvas.getByText("chart-5")).toBeVisible();
  },
};
