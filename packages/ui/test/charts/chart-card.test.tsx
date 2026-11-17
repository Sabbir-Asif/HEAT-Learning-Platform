import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ChartCard, type ChartCardProps } from "../../src/charts/chart-card";
import { stubMatchMedia, stubResizeObserver } from "../support/dom";

const props: ChartCardProps = {
  title: "Enrollments per month",
  summary: "Enrollments grew from 12 in October to 20 in November.",
  xKey: "month",
  xLabel: "Month",
  series: [{ key: "enrolled", label: "Enrolled" }],
  data: [
    { month: "Oct", enrolled: 12 },
    { month: "Nov", enrolled: 20 },
  ],
};

beforeEach(() => {
  stubMatchMedia(() => false);
  stubResizeObserver();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const download = () => screen.getByRole("button", { name: "Download CSV" }) as HTMLButtonElement;

describe("ChartCard long labels", () => {
  test("the data table keeps the full label when tick labels are shortened", () => {
    const label = "Which of these is a form of consent that can be withdrawn?";
    render(
      <ChartCard
        {...props}
        kind="bar"
        xKey="question"
        xLabel="Question"
        xTickMaxLength={12}
        series={[{ key: "missPercent", label: "Missed (%)" }]}
        data={[{ question: label, missPercent: 62 }]}
      />,
    );
    expect(screen.getByRole("rowheader", { hidden: true }).textContent).toBe(label);
  });
});

describe("ChartCard states", () => {
  test("ready shows the summary, the data table and an enabled download", () => {
    render(<ChartCard {...props} />);
    expect(screen.getByRole("img", { name: props.summary })).not.toBeNull();
    expect(screen.getByRole("table", { hidden: true })).not.toBeNull();
    expect(download().disabled).toBe(false);
  });

  test("loading shows a status skeleton, marks busy and disables the download", () => {
    const { container } = render(<ChartCard {...props} status="loading" />);
    expect(screen.getByRole("status", { name: "Loading chart" })).not.toBeNull();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(download().disabled).toBe(true);
  });

  test("error shows an alert with a retry that calls the handler", () => {
    const onRetry = vi.fn();
    render(<ChartCard {...props} status="error" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(download().disabled).toBe(true);
  });

  test("empty shows the empty state and disables the download", () => {
    render(<ChartCard {...props} data={[]} />);
    expect(screen.getByText("No data yet")).not.toBeNull();
    expect(screen.queryByRole("img", { name: props.summary })).toBeNull();
    expect(download().disabled).toBe(true);
  });
});

describe("ChartCard CSV export", () => {
  test("downloads exactly the rows shown, named after the title", async () => {
    let blob: Blob | undefined;
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (value: Blob) => {
          blob = value;
          return "blob:test";
        },
        revokeObjectURL: () => undefined,
      }),
    );
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    render(<ChartCard {...props} />);
    fireEvent.click(download());
    expect(names[0]).toMatch(/^enrollments-per-month-\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(
      "﻿Month,Enrolled\r\nOct,12\r\nNov,20",
    );
  });
});
