import type { MouseEvent } from "react";

export interface LocaleSwitchOption<T extends string = string> {
  value: T;
  label: string;
  href: string;
}

export interface LocaleSwitchProps<T extends string = string> {
  label: string;
  current: T;
  options: LocaleSwitchOption<T>[];
  onChange?: (value: T) => void;
}

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

export function LocaleSwitch<T extends string = string>({
  label,
  current,
  options,
  onChange,
}: LocaleSwitchProps<T>) {
  return (
    <nav aria-label={label} className="heat-locale-switch">
      <ul>
        {options.map((option) => {
          const isCurrent = option.value === current;
          return (
            <li key={option.value}>
              <a
                href={option.href}
                lang={option.value}
                hrefLang={option.value}
                aria-current={isCurrent ? "true" : undefined}
                onClick={(event) => {
                  if (!onChange || !isPlainClick(event)) return;
                  event.preventDefault();
                  if (!isCurrent) onChange(option.value);
                }}
              >
                {option.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
