import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PageSection } from "./page-section";

const meta = {
  title: "Composites/PageSection",
  component: PageSection,
  tags: ["test"],
  args: {
    id: "courses",
    title: "Training courses",
    description: "Pick a course and start learning.",
    children: <p>Content</p>,
  },
} satisfies Meta<typeof PageSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("region", { name: "Training courses" }),
    ).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
