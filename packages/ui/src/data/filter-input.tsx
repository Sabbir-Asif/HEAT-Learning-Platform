"use client";

import * as React from "react";
import { cn } from "../lib/utils";

type FilterInputProps = Omit<React.ComponentProps<"input">, "className"> & {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  className?: string;
};

function FilterInput({ label, icon, error, className, id, ...props }: FilterInputProps) {
  const generated = React.useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  const filled = props.value !== undefined ? props.value !== "" : Boolean(props.defaultValue);
  return (
    <div data-slot="filter-input" className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        data-active={filled ? "" : undefined}
        className="border-input focus-within:border-ring focus-within:ring-ring/50 data-active:border-primary/40 data-active:bg-primary/5 has-[input[aria-invalid=true]]:border-destructive bg-background flex h-9 min-w-0 cursor-text items-center gap-2 rounded-md border pr-3 pl-3 text-sm shadow-xs transition-colors focus-within:ring-3"
      >
        {icon ? (
          <span className="text-muted-foreground flex items-center [&_svg:not([class*='size-'])]:size-4">
            {icon}
          </span>
        ) : null}
        <span className="text-muted-foreground font-medium whitespace-nowrap">{label}</span>
        <input
          id={inputId}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className="placeholder:text-muted-foreground/70 text-foreground h-full min-w-0 flex-1 bg-transparent font-medium outline-none md:w-32 md:flex-none"
          {...props}
        />
      </label>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive pl-3 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FilterInput };
export type { FilterInputProps };
