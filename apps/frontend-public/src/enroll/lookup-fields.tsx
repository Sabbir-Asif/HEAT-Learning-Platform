import {
  EmptyState,
  ErrorState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heat/ui";
import type { FormControlProps } from "@heat/ui";
import { BuildingIcon } from "lucide-react";
import type { Ref } from "react";

export interface LookupOption {
  id: string;
  name: string;
}

export const noOptions: LookupOption[] = [];

interface LookupSelectProps {
  label: string;
  placeholder: string;
  options: readonly LookupOption[];
  disabled: boolean;
  value: string;
  triggerProps: FormControlProps & { ref: Ref<HTMLButtonElement>; onBlur: () => void };
  onChange: (value: string) => void;
}

export function LookupSelect({
  label,
  placeholder,
  options,
  disabled,
  value,
  triggerProps,
  onChange,
}: LookupSelectProps) {
  const items = options.map((option) => ({ value: option.id, label: option.name }));
  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(value) => onChange(value ?? "")}
      disabled={disabled}
    >
      <SelectTrigger {...triggerProps} aria-label={label} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface LookupStateProps {
  failed: boolean;
  empty: boolean;
  emptyTitle: string;
  onRetry: () => void;
}

export function LookupState({ failed, empty, emptyTitle, onRetry }: LookupStateProps) {
  if (failed) {
    return (
      <ErrorState
        title="The list could not be loaded"
        description="Check your connection and try again."
        onRetry={onRetry}
      />
    );
  }
  if (empty) return <EmptyState icon={BuildingIcon} title={emptyTitle} />;
  return null;
}
