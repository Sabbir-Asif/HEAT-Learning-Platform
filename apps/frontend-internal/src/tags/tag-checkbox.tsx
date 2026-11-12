"use client";

import { Checkbox, Field, FieldLabel } from "@heat/ui";
import { useId } from "react";

type TagCheckboxProps = {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
};

export function TagCheckbox({ label, checked, disabled, onChange }: TagCheckboxProps) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  );
}
