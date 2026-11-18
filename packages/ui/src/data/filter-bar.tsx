"use client";

import * as React from "react";
import { FilterIcon, XIcon } from "lucide-react";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
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
  return (
    <div
      data-slot="filter-bar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {search ? <div className="min-w-0 flex-1 md:max-w-xs">{search}</div> : null}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          <FilterIcon data-icon="inline-start" />
          Filters
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </PopoverTrigger>
        <PopoverContent className="flex w-96 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Filters</p>
            <div className="flex items-center gap-1">
              <Badge variant={activeCount > 0 ? "secondary" : "outline"}>
                {activeCount} selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={activeCount === 0}>
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 *:w-full *:max-w-none">{children}</div>
        </PopoverContent>
      </Popover>
      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

export { FilterBar };
export type { FilterBarProps };
