import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { fixturePartners } from "./fixtures";
import { PublicFooter } from "./public-footer";

const meta = {
  title: "Shell/PublicFooter",
  component: PublicFooter,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  args: {
    brand: {
      name: "HEAT Safety Training",
      description: "A gender safety course for University of Dhaka students.",
    },
    columns: [
      {
        title: "Learn",
        links: [
          { href: "/courses", label: "Training modules" },
          { href: "/verify", label: "Verify a certificate" },
        ],
      },
      {
        title: "Contact",
        links: [{ href: "mailto:support@example.edu", label: "support@example.edu" }],
      },
    ],
    partners: fixturePartners,
    legal: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/accessibility", label: "Accessibility" },
    ],
    copyright: "Copyright 2026 University of Dhaka. All rights reserved.",
  },
} satisfies Meta<typeof PublicFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("contentinfo")).toBeVisible();
    await expect(canvas.getByRole("img", { name: "World Bank" })).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Legal" })).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
