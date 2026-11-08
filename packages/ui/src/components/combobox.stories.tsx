import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox";

const departments = [
  "Anthropology",
  "Botany",
  "Chemistry",
  "Economics",
  "English",
  "Law",
  "Physics",
  "Sociology",
];

const meta = {
  title: "Primitives/Combobox",
  component: Combobox,
  tags: ["test"],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const picker = (defaultOpen: boolean) => (
  <div className="max-w-xs p-4">
    <Combobox items={departments} defaultOpen={defaultOpen}>
      <ComboboxInput aria-label="Department" placeholder="Search departments" />
      <ComboboxContent>
        <ComboboxEmpty>No department found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
);

export const Default: Story = { render: () => picker(false) };

export const Light: Story = { render: () => picker(false), globals: { theme: "light" } };

export const Dark: Story = { render: () => picker(false), globals: { theme: "dark" } };

export const Open: Story = { render: () => picker(true) };

export const OpenDark: Story = { render: () => picker(true), globals: { theme: "dark" } };

export const Invalid: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Combobox items={departments}>
        <ComboboxInput aria-label="Department" aria-invalid placeholder="Search departments" />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-xs p-4">
      <Combobox items={departments} disabled>
        <ComboboxInput aria-label="Department" placeholder="Search departments" />
      </Combobox>
    </div>
  ),
};

export const EmptyResults: Story = {
  render: () => picker(false),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("combobox", { name: "Department" });
    await userEvent.type(input, "zzz");
    await expect(await screen.findByText("No department found.")).toBeVisible();
  },
};

export const Keyboard: Story = {
  render: () => picker(false),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("combobox", { name: "Department" });
    input.focus();
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(input).toHaveFocus();
    await expect((input as HTMLInputElement).value).not.toBe("");
  },
};
