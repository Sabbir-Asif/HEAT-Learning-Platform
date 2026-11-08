import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Field, FieldLabel } from "./field";
import { Checkbox } from "./checkbox";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  tags: ["test"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="p-4">
    <Field orientation="horizontal">
      <Checkbox id="terms" />
      <FieldLabel htmlFor="terms">I agree to the training terms</FieldLabel>
    </Field>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Disabled: Story = {
  render: () => (
    <div className="p-4">
      <Field orientation="horizontal">
        <Checkbox id="disabled" disabled />
        <FieldLabel htmlFor="disabled">Unavailable</FieldLabel>
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="p-4">
      <Field orientation="horizontal" data-invalid>
        <Checkbox id="invalid" aria-invalid />
        <FieldLabel htmlFor="invalid">I agree to the training terms</FieldLabel>
      </Field>
    </div>
  ),
};

export const Keyboard: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.tab();
    const box = canvas.getByRole("checkbox");
    await expect(box).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(box).toBeChecked();
  },
};
