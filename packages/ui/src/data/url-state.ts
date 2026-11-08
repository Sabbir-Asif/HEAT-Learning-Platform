export const pageSizes = [10, 25, 50] as const;

export type PageSize = (typeof pageSizes)[number];

export const defaultPageSize: PageSize = 25;

export type SortState = { id: string; desc: boolean };

function readInteger(raw: string | null): number | null {
  if (raw === null || !/^-?\d+$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

export function parsePageSize(raw: string | null): PageSize {
  const value = readInteger(raw);
  return pageSizes.find((size) => size === value) ?? defaultPageSize;
}

export function parsePage(raw: string | null): number {
  const value = readInteger(raw);
  return value !== null && value >= 1 ? value : 1;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function parseSort(raw: string | null, sortable: readonly string[]): SortState | null {
  if (!raw) return null;
  const desc = raw.startsWith("-");
  const id = desc ? raw.slice(1) : raw;
  return sortable.includes(id) ? { id, desc } : null;
}

export function serializeSort(sort: SortState | null): string | null {
  if (!sort) return null;
  return sort.desc ? `-${sort.id}` : sort.id;
}

export function nextSort(current: SortState | null, id: string): SortState | null {
  if (!current || current.id !== id) return { id, desc: false };
  return current.desc ? null : { id, desc: true };
}

export function rangeText(page: number, pageSize: number, total: number): string {
  if (total === 0) return "0 results";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${first} to ${last} of ${total}`;
}

export type PageInputResult = { ok: true; page: number } | { ok: false; message: string };

export function validatePageInput(raw: string, lastPage: number): PageInputResult {
  const value = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
  if (value === null || value < 1 || value > lastPage) {
    return { ok: false, message: `Enter a page from 1 to ${lastPage}.` };
  }
  return { ok: true, page: value };
}
