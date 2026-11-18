"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../components/input-group";
import { cn } from "../lib/utils";

type SearchInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
  className?: string;
};

const defaultDebounceMs = 300;

function SearchInput({
  label,
  placeholder,
  value,
  onValueChange,
  debounceMs = defaultDebounceMs,
  className,
}: SearchInputProps) {
  const [text, setText] = React.useState(value);
  const committed = React.useRef(value);
  const onChange = React.useRef(onValueChange);
  React.useEffect(() => {
    onChange.current = onValueChange;
  });

  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  React.useEffect(() => {
    const next = text.trim();
    if (next === committed.current) return undefined;
    const timer = setTimeout(() => {
      committed.current = next;
      onChange.current(next);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  const clear = () => {
    setText("");
    if (committed.current !== "") {
      committed.current = "";
      onChange.current("");
    }
  };

  return (
    <InputGroup
      data-slot="search-input"
      className={cn("h-9 rounded-md shadow-xs md:max-w-xs", className)}
    >
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text !== "") {
            event.preventDefault();
            clear();
          }
        }}
        className="[&::-webkit-search-cancel-button]:appearance-none"
      />
      {text !== "" ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={clear}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export { SearchInput };
export type { SearchInputProps };
