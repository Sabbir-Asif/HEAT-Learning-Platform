"use client";

import * as React from "react";
import { FilterIcon, XIcon } from "lucide-react";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/sheet";
import { useIsMobile } from "../hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  if (!isMobile) {
    return (
      <div
        data-slot="filter-bar"
        className={cn("flex flex-wrap items-end gap-3", className)}
        {...props}
      >
        {search}
        {children}
        {activeCount > 0 ? (
          <Button variant="ghost" onClick={onClear}>
            <XIcon data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div data-slot="filter-bar" className={cn("flex items-end gap-2", className)} {...props}>
      <div className="min-w-0 flex-1">{search}</div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" />}>
          <FilterIcon data-icon="inline-start" />
          Filters
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the list. Changes apply as you make them.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">{children}</div>
          <SheetFooter>
            <Button variant="outline" onClick={onClear} disabled={activeCount === 0}>
              Clear
            </Button>
            <SheetClose render={<Button />}>Apply</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { FilterBar };
export type { FilterBarProps };
