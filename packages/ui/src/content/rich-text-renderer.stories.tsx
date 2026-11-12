import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { RichTextRenderer } from "./rich-text-renderer";

const meta = {
  title: "Content/RichTextRenderer",
  component: RichTextRenderer,
  tags: ["test"],
  args: {
    document: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Why this matters" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Everyone is responsible for " },
            { type: "text", text: "a safe campus", marks: [{ type: "bold" }] },
            { type: "text", text: "." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Listen" }] }],
            },
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof RichTextRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Why this matters")).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
