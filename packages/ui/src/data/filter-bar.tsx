"use client";

import * as React from "react";
import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { cn } from "../lib/utils";

type FilterBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  activeCount: number;
  onClear: () => void;
  search?: React.ReactNode;
};

function FilterBar({
  children,
  activeCount,
  onClear,
  search,
  className,
  ...props
}: FilterBarProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  return (
    <div
      data-slot="filter-bar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {search ? <div className="min-w-0 flex-1 md:w-60 md:flex-none">{search}</div> : null}
      <Button
        variant="outline"
        className="md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontalIcon data-icon="inline-start" />
        Filters
        {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        <ChevronDownIcon
          data-icon="inline-end"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </Button>
      <div
        id={panelId}
        role="group"
        aria-label="Filters"
        className={cn("w-full flex-col gap-2 md:contents", open ? "flex" : "hidden md:contents")}
      >
        {children}
      </div>
      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          Clear
          <Badge variant="secondary">{activeCount}</Badge>
        </Button>
      ) : null}
    </div>
  );
}

export { FilterBar };
export type { FilterBarProps };
