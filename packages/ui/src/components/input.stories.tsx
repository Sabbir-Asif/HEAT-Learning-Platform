import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";

const meta = {
  title: "Primitives/Input",
  component: Input,
  tags: ["test"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="max-w-sm p-4">
    <Field>
      <FieldLabel htmlFor="name">Full name</FieldLabel>
      <Input id="name" placeholder="Rahima Akter" />
      <FieldDescription>As it should appear on your certificate.</FieldDescription>
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
        <FieldLabel htmlFor="disabled">Student ID</FieldLabel>
        <Input id="disabled" value="2021-1-60-001" disabled readOnly />
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="max-w-sm p-4">
      <Field data-invalid>
        <FieldLabel htmlFor="invalid">Email</FieldLabel>
        <Input id="invalid" aria-invalid aria-describedby="invalid-error" defaultValue="rahima" />
        <FieldError id="invalid-error">Enter a valid email address.</FieldError>
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Email");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("Enter a valid email address.");
  },
};

export const Focus: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.tab();
    await expect(canvas.getByLabelText("Full name")).toHaveFocus();
  },
};
