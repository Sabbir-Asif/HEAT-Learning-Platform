import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import { ChartCard, type ChartRow } from "./chart-card";
import { buildCsv } from "./csv";

const data: ChartRow[] = [
  { month: "Jul", enrolled: 42, completed: 18, dropped: 4 },
  { month: "Aug", enrolled: 58, completed: 30, dropped: 6 },
  { month: "Sep", enrolled: 73, completed: 41, dropped: 5 },
  { month: "Oct", enrolled: 96, completed: 55, dropped: 9 },
];

const series = [
  { key: "enrolled", label: "Enrolled" },
  { key: "completed", label: "Completed" },
] as [{ key: string; label: string }, { key: string; label: string }];

const onRetry = fn();

const meta = {
  title: "Charts/ChartCard",
  component: ChartCard,
  tags: ["test"],
  args: {
    title: "Learners by month",
    description: "Enrolled and completed, July to October",
    summary: "Enrolled grew from 42 in July to 96 in October. Completed grew from 18 to 55.",
    xKey: "month",
    xLabel: "Month",
    series,
    data,
    onRetry,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("img", { name: /Enrolled grew from 42 in July to 96 in October/ }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Download CSV" })).toBeEnabled();
    await userEvent.click(canvas.getByText("View data as a table"));
    await expect(canvas.getByRole("table", { name: "Learners by month" })).toBeInTheDocument();
    await expect(canvas.getByRole("rowheader", { name: "Oct" })).toBeInTheDocument();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const Bars: Story = { args: { kind: "bar" } };

export const FiveSeries: Story = {
  args: {
    series: [
      { key: "enrolled", label: "Enrolled" },
      { key: "completed", label: "Completed" },
      { key: "dropped", label: "Dropped" },
      { key: "waitlisted", label: "Waitlisted" },
      { key: "transferred", label: "Transferred" },
    ],
    data: data.map((row, index) => ({ ...row, waitlisted: 10 + index, transferred: 3 + index })),
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status", { name: "Loading chart" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  },
};

export const Empty: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No data yet")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  },
};

export const ErrorWithRetry: Story = {
  args: { status: "error" },
  play: async ({ canvasElement }) => {
    onRetry.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(onRetry).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  },
};

export const CsvHasExactlyTheDataShown: Story = {
  play: async ({ canvasElement }) => {
    let captured: Blob | undefined;
    const create = spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      captured = blob as Blob;
      return "blob:chart";
    });
    const revoke = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Download CSV" }));

    await waitFor(() => expect(captured).toBeDefined());
    const expected = buildCsv([{ key: "month", label: "Month" }, ...series], data);
    const bytes = new Uint8Array((await captured?.arrayBuffer()) ?? new ArrayBuffer(0));
    await expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    await expect(await captured?.text()).toBe(expected.replace("\uFEFF", ""));
    await expect(revoke).toHaveBeenCalledWith("blob:chart");

    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Download CSV" })).toBeInTheDocument();
  },
};
