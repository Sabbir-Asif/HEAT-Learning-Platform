import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Field, FieldError, FieldLabel } from "./field";
import { Textarea } from "./textarea";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  tags: ["test"],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="max-w-sm p-4">
    <Field>
      <FieldLabel htmlFor="message">Message</FieldLabel>
      <Textarea id="message" />
    </Field>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Disabled: Story = {
  render: () => (
    <div className="max-w-sm p-4">
      <Field>
        <FieldLabel htmlFor="disabled">Message</FieldLabel>
        <Textarea id="disabled" disabled defaultValue="Locked" />
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="max-w-sm p-4">
      <Field data-invalid>
        <FieldLabel htmlFor="invalid">Message</FieldLabel>
        <Textarea id="invalid" aria-invalid aria-describedby="invalid-error" />
        <FieldError id="invalid-error">Write at least one sentence.</FieldError>
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Message")).toHaveAccessibleDescription(
      "Write at least one sentence.",
    );
  },
};

export const Focus: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.tab();
    await expect(canvas.getByLabelText("Message")).toHaveFocus();
  },
};
