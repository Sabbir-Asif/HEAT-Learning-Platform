import type { MouseEvent } from "react";

export interface LocaleSwitchOption {
  value: string;
  label: string;
  href: string;
}

export interface LocaleSwitchProps {
  label: string;
  current: string;
  options: LocaleSwitchOption[];
  onChange?: (value: string) => void;
}

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

export function LocaleSwitch({ label, current, options, onChange }: LocaleSwitchProps) {
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
