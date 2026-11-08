import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Field, FieldLabel } from "./field";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta = {
  title: "Primitives/RadioGroup",
  component: RadioGroup,
  tags: ["test"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="p-4">
    <RadioGroup defaultValue="video" aria-label="Lesson format">
      <Field orientation="horizontal">
        <RadioGroupItem id="video" value="video" />
        <FieldLabel htmlFor="video">Video</FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <RadioGroupItem id="text" value="text" />
        <FieldLabel htmlFor="text">Text</FieldLabel>
      </Field>
    </RadioGroup>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Disabled: Story = {
  render: () => (
    <div className="p-4">
      <RadioGroup defaultValue="video" aria-label="Lesson format" disabled>
        <Field orientation="horizontal">
          <RadioGroupItem id="video" value="video" />
          <FieldLabel htmlFor="video">Video</FieldLabel>
        </Field>
      </RadioGroup>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="p-4">
      <RadioGroup aria-label="Lesson format" aria-invalid>
        <Field orientation="horizontal" data-invalid>
          <RadioGroupItem id="video" value="video" aria-invalid />
          <FieldLabel htmlFor="video">Video</FieldLabel>
        </Field>
      </RadioGroup>
    </div>
  ),
};

export const Keyboard: Story = {
  render: content,
  play: async ({ canvas }) => {
    await userEvent.tab();
    await expect(canvas.getByRole("radio", { name: "Video" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("radio", { name: "Text" })).toBeChecked();
  },
};
