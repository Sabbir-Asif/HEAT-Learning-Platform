import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClockIcon, ShieldCheckIcon } from "lucide-react";
import { expect } from "storybook/test";
import { AuthLayout } from "./auth-layout";
import { fixtureLogo } from "./fixtures";

const meta = {
  title: "Shell/AuthLayout",
  component: AuthLayout,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  args: {
    brand: { name: "Gender Safety Training", href: "/", logos: [fixtureLogo] },
    panel: {
      headline: "A safer campus starts with people who know what to do.",
      points: [
        { icon: ClockIcon, label: "Short, self-paced lessons" },
        { icon: ShieldCheckIcon, label: "Your progress stays confidential" },
      ],
    },
    children: <h1 className="font-display text-heading-1">Sign in</h1>,
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("main")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Sign in" })).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
