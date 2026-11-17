"use client";

import * as React from "react";
import { BarChart3Icon, DownloadIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/card";
import { Skeleton } from "../components/skeleton";
import { EmptyState } from "../composites/empty-state";
import { ErrorState } from "../composites/error-state";
import { PageHeaderAction } from "../composites/page-header";
import { cn } from "../lib/utils";
import { buildCsv, csvFileName, downloadCsv } from "./csv";

type ChartSeries = { key: string; label: string };

type UpToFive<T> = [T] | [T, T] | [T, T, T] | [T, T, T, T] | [T, T, T, T, T];

type ChartRow = Record<string, string | number | null>;

type ChartCardProps = {
  title: string;
  description?: string;
  summary: string;
  kind?: "line" | "bar";
  xKey: string;
  xLabel: string;
  xTickMaxLength?: number;
  series: UpToFive<ChartSeries>;
  data: ChartRow[];
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  className?: string;
};

const dashes = [undefined, "6 3", "2 2", "8 3 2 3", "1 4"];

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const list = window.matchMedia(reducedMotionQuery);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
};

const tick = { fill: "var(--muted-foreground)", fontSize: 12 };

function shortenTick(value: unknown, maxLength: number | undefined): string {
  const text = String(value);
  if (maxLength === undefined || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function ChartCard({
  title,
  description,
  summary,
  kind = "line",
  xKey,
  xLabel,
  xTickMaxLength,
  series,
  data,
  status = "ready",
  onRetry,
  className,
}: ChartCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const hasData = data.length > 0;

  function download() {
    const columns = [{ key: xKey, label: xLabel }, ...series];
    downloadCsv(csvFileName(title, new Date()), buildCsv(columns, data));
  }

  const frame = "flex h-64 w-full items-center justify-center";

  let content: React.ReactNode;
  if (status === "loading") {
    content = <Skeleton className="h-64 w-full" role="status" aria-label="Loading chart" />;
  } else if (status === "error") {
    content = <ErrorState onRetry={onRetry} className={frame} />;
  } else if (!hasData) {
    content = (
      <EmptyState
        icon={BarChart3Icon}
        title="No data yet"
        description="There is nothing to chart for this period."
        className={frame}
      />
    );
  } else {
    const Chart = kind === "bar" ? BarChart : LineChart;
    content = (
      <>
        <div role="img" aria-label={summary} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={tick}
                tickLine={false}
                minTickGap={16}
                tickFormatter={(value: unknown) => shortenTick(value, xTickMaxLength)}
              />
              <YAxis tick={tick} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
              <Legend />
              {series.map((item, index) =>
                kind === "bar" ? (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    name={item.label}
                    fill={`var(--chart-${index + 1})`}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!reducedMotion}
                  />
                ) : (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.label}
                    stroke={`var(--chart-${index + 1})`}
                    strokeWidth={2}
                    strokeDasharray={dashes[index]}
                    dot={{ r: 3 }}
                    isAnimationActive={!reducedMotion}
                  />
                ),
              )}
            </Chart>
          </ResponsiveContainer>
        </div>
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer py-2">
            View data as a table
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 font-medium">
                    {xLabel}
                  </th>
                  {series.map((item) => (
                    <th key={item.key} scope="col" className="p-2 font-medium">
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <th scope="row" className="p-2 font-normal">
                      {row[xKey]}
                    </th>
                    {series.map((item) => (
                      <td key={item.key} className="p-2">
                        {row[item.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </>
    );
  }

  return (
    <Card data-slot="chart-card" className={cn(className)} aria-busy={status === "loading"}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <PageHeaderAction
            icon={DownloadIcon}
            label="Download CSV"
            variant="outline"
            size="sm"
            disabled={status !== "ready" || !hasData}
            onClick={download}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{content}</CardContent>
    </Card>
  );
}

export { ChartCard };
export type { ChartCardProps, ChartRow, ChartSeries, UpToFive };
