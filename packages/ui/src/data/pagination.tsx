"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { cn } from "../lib/utils";
import { pageCount, pageSizes, rangeText, validatePageInput, type PageSize } from "./url-state";

type PaginationProps = Omit<React.ComponentProps<"nav">, "onChange"> & {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

const sizeItems = pageSizes.map((size) => ({ value: String(size), label: `${size} per page` }));

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
  ...props
}: PaginationProps) {
  const last = pageCount(total, pageSize);
  const [draft, setDraft] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const messageId = React.useId();

  function goTo(event: React.FormEvent) {
    event.preventDefault();
    const result = validatePageInput(draft, last);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    setDraft("");
    onPageChange(result.page);
  }

  const atStart = page <= 1;
  const atEnd = page >= last;

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
      {...props}
    >
      <p className="text-muted-foreground text-sm">{rangeText(page, pageSize, total)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={sizeItems}
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
        >
          <SelectTrigger aria-label="Rows per page" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="First page"
            disabled={atStart}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={atStart}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="px-2 text-sm">
            Page {page} of {last}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={atEnd}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Last page"
            disabled={atEnd}
            onClick={() => onPageChange(last)}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
        <form onSubmit={goTo} className="flex flex-col gap-1" noValidate>
          <Input
            aria-label="Go to page"
            aria-invalid={message !== null}
            aria-describedby={message ? messageId : undefined}
            inputMode="numeric"
            placeholder="Go to page"
            className="w-28"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setMessage(null);
            }}
          />
          {message ? (
            <p id={messageId} role="alert" className="text-destructive text-xs">
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </nav>
  );
}

export { Pagination };
export type { PaginationProps };
