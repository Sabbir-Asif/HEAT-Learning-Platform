import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { Pagination } from "./pagination";
import type { PageSize } from "./url-state";

function Demo({ total }: { total: number }) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<PageSize>(10);
  return (
    <div className="max-w-3xl p-4">
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

const meta = {
  title: "Data/Pagination",
  component: Demo,
  tags: ["test"],
  args: { total: 134 },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 to 10 of 134")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "First page" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Last page" }));
    await expect(canvas.getByText("131 to 134 of 134")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const Empty: Story = {
  args: { total: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0 results")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
};

export const InvalidGoToPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Go to page"), "abc{Enter}");
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Enter a page from 1 to 14.");
    await expect(canvas.getByText("1 to 10 of 134")).toBeInTheDocument();
  },
};
