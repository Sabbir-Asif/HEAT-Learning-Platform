import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Input } from "../components/input";
import { FilterBar } from "./filter-bar";

function Demo() {
  const [query, setQuery] = React.useState("");
  return (
    <div className="max-w-3xl p-4">
      <FilterBar
        activeCount={query ? 1 : 0}
        onClear={() => setQuery("")}
        search={
          <Input
            aria-label="Search"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      >
        <Input aria-label="Cohort" placeholder="Cohort" />
      </FilterBar>
    </div>
  );
}

const meta = {
  title: "Data/FilterBar",
  component: Demo,
  tags: ["test"],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Cohort")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Clear filters" })).toBeNull();
    await userEvent.type(canvas.getByLabelText("Search"), "ana");
    await userEvent.click(await canvas.findByRole("button", { name: "Clear filters" }));
    await expect(canvas.getByLabelText("Search")).toHaveValue("");
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const PhoneEscapeReturnsFocus: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: /Filters/ });
    await userEvent.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    await expect(drawer).toHaveAttribute("data-side", "bottom");
    await expect(within(drawer).getByRole("button", { name: "Close" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const PhoneDark: Story = {
  ...PhoneEscapeReturnsFocus,
  globals: { ...PhoneEscapeReturnsFocus.globals, theme: "dark" },
};
