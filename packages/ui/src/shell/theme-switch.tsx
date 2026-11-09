"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";

const choices = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

const subscribe = () => () => undefined;

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            data-slot="theme-switch"
            variant="ghost"
            size="icon-lg"
            aria-label="Choose theme"
          />
        }
      >
        <SunIcon aria-hidden="true" className="dark:hidden" />
        <MoonIcon aria-hidden="true" className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={mounted ? (theme ?? "system") : ""}
          onValueChange={(value) => setTheme(String(value))}
        >
          {choices.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeSwitch };
