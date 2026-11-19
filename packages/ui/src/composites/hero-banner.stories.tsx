import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../components/button";
import { HeroBanner } from "./hero-banner";

const meta = {
  title: "Composites/HeroBanner",
  component: HeroBanner,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
  args: {
    badge: "HEAT Project (PIN 13019)",
    title: "Preventing Gender-Based Violence in University Campuses",
    description: "An interactive training for students, teachers and university administrators.",
    image: <div className="bg-accent size-full" />,
    actions: <Button size="lg">Start training</Button>,
  },
} satisfies Meta<typeof HeroBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Start training" })).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
