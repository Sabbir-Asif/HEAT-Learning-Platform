import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AboutBanner } from "./about-banner";

const meta = {
  title: "Composites/AboutBanner",
  component: AboutBanner,
  tags: ["test"],
  args: {
    id: "about",
    title: "About the project",
    image: <div className="bg-accent size-full" />,
    children: <p>A short description of the project.</p>,
  },
} satisfies Meta<typeof AboutBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("region", { name: "About the project" }),
    ).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
