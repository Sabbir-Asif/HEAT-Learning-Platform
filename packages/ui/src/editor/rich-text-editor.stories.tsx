import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { RichTextDocument } from "../content";
import { RichTextEditor } from "./rich-text-editor";

const initial: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Start writing" }] }],
};

function Harness() {
  const [value, setValue] = useState(initial);
  return <RichTextEditor label="Lesson text" value={value} onChange={setValue} />;
}

const meta = {
  title: "Editor/RichTextEditor",
  component: Harness,
  tags: ["test"],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("toolbar")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Bold" })).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
