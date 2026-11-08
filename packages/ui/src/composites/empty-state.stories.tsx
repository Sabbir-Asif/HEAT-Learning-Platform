import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Composites/EmptyState",
  component: EmptyState,
  tags: ["test"],
  args: {
    icon: InboxIcon,
    title: "No pending approvals",
    description: "New enrollment requests will appear here.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("No pending approvals")).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
