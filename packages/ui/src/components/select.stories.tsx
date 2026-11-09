import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Field, FieldError, FieldLabel } from "./field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const faculties = [
  { value: "arts", label: "Faculty of Arts" },
  { value: "science", label: "Faculty of Science" },
  {
    value: "bio",
    label: "Faculty of Biological Sciences and Environmental Studies Research Programmes",
  },
];

const meta = {
  title: "Primitives/Select",
  component: Select,
  tags: ["test"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="max-w-xs p-4">
    <Field>
      <FieldLabel id="faculty-label">Faculty</FieldLabel>
      <Select items={faculties} defaultValue="arts">
        <SelectTrigger aria-labelledby="faculty-label" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {faculties.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Disabled: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Select items={faculties} defaultValue="arts" disabled>
        <SelectTrigger aria-label="Faculty" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {faculties.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Field data-invalid>
        <FieldLabel id="faculty-invalid-label">Faculty</FieldLabel>
        <Select items={faculties}>
          <SelectTrigger
            aria-labelledby="faculty-invalid-label"
            aria-invalid
            aria-describedby="faculty-error"
            className="w-full"
          >
            <SelectValue placeholder="Choose a faculty" />
          </SelectTrigger>
          <SelectContent>
            {faculties.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="faculty-error">Choose a faculty.</FieldError>
      </Field>
    </div>
  ),
};

export const LongValue: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Select items={faculties} defaultValue="bio">
        <SelectTrigger aria-label="Faculty" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {faculties.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Open: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Select items={faculties} defaultOpen defaultValue="arts">
        <SelectTrigger aria-label="Faculty" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {faculties.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Keyboard: Story = {
  render: content,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox", { name: "Faculty" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => expect(listbox.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger).toHaveTextContent("Faculty of Science");
    await expect(trigger).toHaveFocus();
  },
};
