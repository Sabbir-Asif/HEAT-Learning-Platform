"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { cn } from "../lib/utils";

type FilterSelectItem = { value: string; label: string };

type FilterSelectProps = {
  label: string;
  icon?: React.ReactNode;
  items: ReadonlyArray<FilterSelectItem>;
  value: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  note?: string;
  className?: string;
};

function FilterSelect({
  label,
  icon,
  items,
  value,
  defaultValue,
  onValueChange,
  disabled,
  note,
  className,
}: FilterSelectProps) {
  const fallback = defaultValue ?? items[0]?.value ?? "";
  const active = value !== fallback;
  return (
    <Select
      items={items as FilterSelectItem[]}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger
        data-slot="filter-select"
        data-active={active ? "" : undefined}
        aria-label={label}
        className={cn(
          "data-active:border-primary/40 data-active:bg-primary/5 h-9 w-full min-w-0 gap-2 rounded-md pr-2.5 pl-3 shadow-xs data-[size=default]:h-9 md:w-auto md:max-w-56",
          className,
        )}
      >
        {icon ? <span className="text-muted-foreground flex items-center">{icon}</span> : null}
        <span className="text-muted-foreground font-medium">{label}</span>
        <SelectValue className={cn("text-foreground truncate font-medium", !active && "hidden!")} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="w-auto min-w-52">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
        {note ? <SelectLabel>{note}</SelectLabel> : null}
      </SelectContent>
    </Select>
  );
}

export { FilterSelect };
export type { FilterSelectItem, FilterSelectProps };
