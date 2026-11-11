"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "../components/button";
import { cn } from "../lib/utils";

type SortableDirection = "up" | "down";

type SortableItem = {
  id: string;
  label: string;
  content?: React.ReactNode;
};

type SortableListProps = Omit<React.ComponentProps<"ol">, "children"> & {
  items: readonly SortableItem[];
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
};

function moveId(ids: readonly string[], id: string, direction: SortableDirection): string[] | null {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  const moved = next[index];
  const swapped = next[target];
  if (moved === undefined || swapped === undefined) return null;
  next[index] = swapped;
  next[target] = moved;
  return next;
}

function SortableList({
  items,
  onReorder,
  disabled = false,
  className,
  ...props
}: SortableListProps) {
  const listRef = React.useRef<HTMLOListElement>(null);
  const pendingFocus = React.useRef<{ id: string; direction: SortableDirection } | null>(null);

  React.useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null) return;
    pendingFocus.current = null;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-sortable-id="${pending.id}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(`[data-move="${pending.direction}"]`);
    const other = pending.direction === "up" ? "down" : "up";
    const fallback = row?.querySelector<HTMLButtonElement>(`[data-move="${other}"]`);
    if (preferred && !preferred.disabled) preferred.focus();
    else fallback?.focus();
  }, [items]);

  const ids = items.map((item) => item.id);

  function move(id: string, direction: SortableDirection) {
    const next = moveId(ids, id, direction);
    if (next === null || disabled) return;
    pendingFocus.current = { id, direction };
    onReorder(next);
  }

  return (
    <ol
      ref={listRef}
      data-slot="sortable-list"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          data-sortable-id={item.id}
          className="border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2"
        >
          <div className="min-w-0 flex-1 break-words">{item.content ?? item.label}</div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              data-move="up"
              aria-label={`Move ${item.label} up`}
              disabled={disabled || index === 0}
              onClick={() => move(item.id, "up")}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              data-move="down"
              aria-label={`Move ${item.label} down`}
              disabled={disabled || index === items.length - 1}
              onClick={() => move(item.id, "down")}
            >
              <ArrowDownIcon />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export { SortableList, moveId };
export type { SortableDirection, SortableItem, SortableListProps };
