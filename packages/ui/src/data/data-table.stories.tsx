import type { Meta, StoryObj } from "@storybook/react-vite";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { PencilIcon } from "lucide-react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { DataTable, type DataTableColumn, type DataTableStatus } from "./data-table";
import { FilterBar } from "./filter-bar";
import { useClampedPage, useTableUrlState } from "./use-table-url-state";

type Student = { id: string; name: string; status: string; joined: string };

const statuses = ["approved", "pending", "rejected"];

const students: Student[] = Array.from({ length: 134 }, (_, index) => ({
  id: `s${index + 1}`,
  name: `Student ${String(index + 1).padStart(3, "0")}`,
  status: statuses[index % 3] ?? "approved",
  joined: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
}));

const columns: DataTableColumn<Student>[] = [
  { id: "name", header: "Name", cell: (row) => row.name, sortable: true },
  { id: "status", header: "Status", cell: (row) => row.status },
  { id: "joined", header: "Joined", cell: (row) => row.joined, sortable: true },
];

const sortable = ["name", "joined"];
const filterKeys = ["status"];

type DemoProps = { scenario?: DataTableStatus | "empty"; fetching?: boolean; noActions?: boolean };

const filterOptions = { status: statuses };

function Demo({ scenario = "ready", fetching = false, noActions = false }: DemoProps) {
  const url = useTableUrlState({ sortable, filters: filterKeys, filterOptions });
  const matching = students.filter(
    (student) =>
      (!url.query || student.name.toLowerCase().includes(url.query.toLowerCase())) &&
      (!url.filters.status || student.status === url.filters.status),
  );
  const sorted = url.sort
    ? [...matching].sort((a, b) => {
        const left = String(a[url.sort?.id as keyof Student]);
        const right = String(b[url.sort?.id as keyof Student]);
        return url.sort?.desc ? right.localeCompare(left) : left.localeCompare(right);
      })
    : matching;
  const page = useClampedPage(url.page, url.pageSize, matching.length, url.setPage);
  const total = scenario === "empty" ? 0 : sorted.length;
  const pageRows =
    scenario === "empty" ? [] : sorted.slice((page - 1) * url.pageSize, page * url.pageSize);

  return (
    <div className="flex max-w-4xl flex-col gap-4 p-4">
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <Input
            aria-label="Search students"
            placeholder="Search students"
            value={url.query}
            onChange={(event) => url.setQuery(event.target.value)}
          />
        }
      >
        <Select
          value={url.filters.status ?? ""}
          onValueChange={(value) => url.setFilter("status", value)}
          items={statuses.map((value) => ({ value, label: value }))}
        >
          <SelectTrigger aria-label="Status" className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>
      <DataTable
        label="Students"
        columns={columns}
        rows={scenario === "loading" ? [] : pageRows}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        fetching={fetching}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={scenario === "loading" ? "loading" : scenario === "error" ? "error" : "ready"}
        onRetry={onRetry}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle="No students yet"
        actions={
          noActions
            ? undefined
            : (row) => (
                <Button variant="ghost" size="icon" aria-label={`Edit ${row.name}`}>
                  <PencilIcon />
                </Button>
              )
        }
      />
    </div>
  );
}

const onRetry = fn();
const onUrlUpdate = fn();

function withUrl(searchParams = "") {
  onUrlUpdate.mockClear();
  const Adapter = withNuqsTestingAdapter({ searchParams, hasMemory: true, onUrlUpdate });
  function UrlDecorator(Story: () => React.ReactElement) {
    return (
      <Adapter>
        <Story />
      </Adapter>
    );
  }
  return UrlDecorator;
}

function lastQuery(): string {
  const call = onUrlUpdate.mock.calls.at(-1);
  return (call?.[0] as { queryString: string } | undefined)?.queryString ?? "";
}

const meta = {
  title: "Data/DataTable",
  component: Demo,
  tags: ["test"],
  decorators: [withUrl()],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("1 to 25 of 134")).toBeInTheDocument());
    await expect(canvas.getByRole("table", { name: "Students" })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: "Status" })).not.toHaveAttribute(
      "aria-sort",
    );
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const SortCycleInUrl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByRole("columnheader", { name: /Name/ });
    const button = within(header).getByRole("button");

    await userEvent.click(button);
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "ascending"));
    await waitFor(() => expect(lastQuery()).toContain("sort=name"));

    await userEvent.click(button);
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "descending"));
    await waitFor(() => expect(lastQuery()).toContain("sort=-name"));

    await userEvent.click(button);
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "none"));
    await waitFor(() => expect(lastQuery()).not.toContain("sort="));
  },
};

export const PagingInUrl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("1 to 25 of 134");
    await expect(canvas.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(canvas.getByText("26 to 50 of 134")).toBeInTheDocument());
    await waitFor(() => expect(lastQuery()).toContain("page=2"));

    await userEvent.click(canvas.getByRole("combobox", { name: "Rows per page" }));
    await userEvent.click(await screen.findByRole("option", { name: "50 per page" }));
    await waitFor(() => expect(canvas.getByText("1 to 50 of 134")).toBeInTheDocument());
    await waitFor(() => expect(lastQuery()).toContain("pageSize=50"));
    await waitFor(() => expect(lastQuery()).not.toContain("page=2"));

    await userEvent.type(canvas.getByLabelText("Go to page"), "9{Enter}");
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Enter a page from 1 to 3.");
    await userEvent.clear(canvas.getByLabelText("Go to page"));
    await userEvent.type(canvas.getByLabelText("Go to page"), "3{Enter}");
    await waitFor(() => expect(canvas.getByText("101 to 134 of 134")).toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
};

export const SearchResetsPage: Story = {
  decorators: [withUrl("?page=3")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("51 to 75 of 134");
    await userEvent.type(canvas.getByLabelText("Search students"), "Student 01");
    await waitFor(() => expect(canvas.getByText("1 to 10 of 10")).toBeInTheDocument());
    await waitFor(() => expect(lastQuery()).toContain("q=Student+01"));
    await expect(lastQuery()).not.toContain("page=");
  },
};

export const RestoredFromUrl: Story = {
  decorators: [withUrl("?page=2&pageSize=10&sort=-name&status=pending")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("11 to 20 of 45")).toBeInTheDocument());
    await expect(canvas.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  },
};

export const InvalidUrlValues: Story = {
  decorators: [withUrl("?page=-3&pageSize=7&sort=email&status=bogus")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("1 to 25 of 134")).toBeInTheDocument());
    await expect(canvas.getByRole("table", { name: "Students" })).toBeInTheDocument();
    await waitFor(() => expect(lastQuery()).toBe(""));
  },
};

export const PageBeyondTheEnd: Story = {
  decorators: [withUrl("?page=99")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("126 to 134 of 134")).toBeInTheDocument());
    await waitFor(() => expect(lastQuery()).toContain("page=6"));
  },
};

export const Loading: Story = {
  args: { scenario: "loading" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("status", { name: "Loading" }),
    ).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { scenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("No students yet")).toBeInTheDocument();
  },
};

export const NoMatches: Story = {
  decorators: [withUrl("?q=zzz")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("No results match the filters")).toBeInTheDocument();
    const clear = canvas.getAllByRole("button", { name: "Clear filters" });
    await userEvent.click(clear[clear.length - 1] as HTMLElement);
    await waitFor(() => expect(canvas.getByText("1 to 25 of 134")).toBeInTheDocument());
  },
};

export const ErrorWithRetry: Story = {
  args: { scenario: "error" },
  play: async ({ canvasElement }) => {
    onRetry.mockClear();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Retry" }));
    await expect(onRetry).toHaveBeenCalledTimes(1);
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("list", { name: "Students" })).toBeInTheDocument());
    await expect(canvas.queryByRole("table")).toBeNull();
    await expect(canvas.getAllByRole("button", { name: /^Edit Student/ })).toHaveLength(25);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const PhoneFilterDrawer: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: /Filters/ });
    await userEvent.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    await expect(drawer).toHaveAttribute("data-side", "bottom");
    await userEvent.click(within(drawer).getByRole("combobox", { name: "Status" }));
    await userEvent.click(await screen.findByRole("option", { name: "pending" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull());
    await waitFor(() => expect(lastQuery()).toContain("status=pending"));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const SortByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByRole("columnheader", { name: /Name/ });
    const button = within(header).getByRole("button");
    button.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "ascending"));
    await userEvent.keyboard(" ");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "descending"));
    await expect(button).toHaveFocus();
  },
};

export const InlineFilters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Search students")).toBeVisible();
    await expect(canvas.getByRole("combobox", { name: "Status" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Filters/ })).toBeNull();
  },
};

export const BusyRefetch: Story = {
  args: { fetching: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Student 001")).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="data-table"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(canvas.queryByText("No students yet")).toBeNull();
  },
};

export const WithoutActions: Story = {
  args: { noActions: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Student 001");
    await expect(canvas.getAllByRole("columnheader")).toHaveLength(3);
    await expect(canvas.queryByRole("button", { name: /^Edit/ })).toBeNull();
  },
};

export const PhoneSort: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("combobox", { name: "Sort by" }));
    await userEvent.click(await screen.findByRole("option", { name: "Name, descending" }));
    await waitFor(() => expect(lastQuery()).toContain("sort=-name"));
    await waitFor(() => expect(canvas.getByText("Student 134")).toBeInTheDocument());
  },
};

export const PhoneDark: Story = { ...Phone, globals: { ...Phone.globals, theme: "dark" } };

export const PhoneFilterDrawerDark: Story = {
  ...PhoneFilterDrawer,
  globals: { ...PhoneFilterDrawer.globals, theme: "dark" },
};
