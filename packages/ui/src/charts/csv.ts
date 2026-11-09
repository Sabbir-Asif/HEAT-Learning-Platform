export type CsvColumn = { key: string; label: string };

export type CsvCell = string | number | boolean | Date | null | undefined;

const byteOrderMark = "﻿";
const lineBreak = "\r\n";
const formulaTriggers = ["=", "+", "-", "@", "\t", "\r"];

const dhakaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDhakaDate(date: Date): string {
  const parts = Object.fromEntries(
    dhakaDay.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function cellText(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return formatDhakaDate(cell);
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return String(cell);
  const visible = cell.replace(/^[\s\u00a0\ufeff]+/u, "");
  const risky = formulaTriggers.some(
    (trigger) => cell.startsWith(trigger) || visible.startsWith(trigger),
  );
  return risky ? `'${cell}` : cell;
}

function escapeCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv(columns: CsvColumn[], rows: Record<string, CsvCell>[]): string {
  const header = columns.map((column) => escapeCell(cellText(column.label))).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(cellText(row[column.key]))).join(","),
  );
  return byteOrderMark + [header, ...body].join(lineBreak);
}

export function csvFileName(title: string, date: Date): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "chart";
  return `${base}-${formatDhakaDate(date)}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
