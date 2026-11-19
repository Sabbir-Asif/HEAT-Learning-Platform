import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpenIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { FeatureTile } from "./feature-tile";

const meta = {
  title: "Composites/FeatureTile",
  component: FeatureTile,
  tags: ["test"],
  args: {
    icon: BookOpenIcon,
    title: "Interactive learning",
    description: "Engaging modules, case studies and real-life scenarios.",
  },
} satisfies Meta<typeof FeatureTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("heading", { level: 3, name: "Interactive learning" }),
    ).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
