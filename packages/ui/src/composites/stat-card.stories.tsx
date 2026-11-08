import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { StatCard } from "./stat-card";

const meta = {
  title: "Composites/StatCard",
  component: StatCard,
  tags: ["test"],
  args: {
    label: "Completion rate",
    value: "72%",
    trend: { direction: "up", text: "4 points since last month" },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Up:")).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const WithoutTrend: Story = { args: { trend: undefined } };
