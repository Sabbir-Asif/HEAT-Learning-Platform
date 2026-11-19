"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@heat/ui";
import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <InputGroup className="h-11">
      <InputGroupAddon>
        <LockIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput type={shown ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
