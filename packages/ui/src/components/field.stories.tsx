import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "./field";
import { Input } from "./input";

const meta = {
  title: "Primitives/Field",
  component: Field,
  tags: ["test"],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="max-w-sm p-4">
    <FieldSet>
      <FieldLegend>Profile</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="first">First name</FieldLabel>
          <Input id="first" />
        </Field>
        <Field>
          <FieldLabel htmlFor="last">Last name</FieldLabel>
          <Input id="last" />
          <FieldDescription>Shown on your certificate.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };
