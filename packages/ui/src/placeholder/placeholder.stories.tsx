import type { Meta, StoryObj } from "@storybook/react-vite";
import { Placeholder } from "./placeholder";

const meta = {
  title: "Placeholder",
  component: Placeholder,
  tags: ["test"],
  parameters: { a11y: { test: "error" } },
  args: {
    heading: "Setup check",
    text: "Storybook runs with the theme, locale and accessibility checks.",
    actionLabel: "Continue",
  },
} satisfies Meta<typeof Placeholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightEnglish: Story = {};
