import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ImageFrame } from "./image-frame";

const meta = {
  title: "Composites/ImageFrame",
  component: ImageFrame,
  tags: ["test"],
  args: { children: "Image slot" },
} satisfies Meta<typeof ImageFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Image slot")).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
