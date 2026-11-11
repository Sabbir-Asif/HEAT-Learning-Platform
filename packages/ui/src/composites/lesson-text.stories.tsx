import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { LessonText } from "./lesson-text";

const text = (value: string) => ({
  kind: "text" as const,
  text: value,
  bold: false,
  italic: false,
  href: null,
});

const meta = {
  title: "Composites/LessonText",
  component: LessonText,
  tags: ["test"],
  args: {
    blocks: [
      { kind: "heading", level: 2, children: [text("Why this matters")] },
      { kind: "paragraph", children: [text("Everyone is responsible for a safe campus.")] },
      { kind: "list", ordered: false, items: [[text("Listen")], [text("Report")]] },
    ],
  },
} satisfies Meta<typeof LessonText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Why this matters")).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
