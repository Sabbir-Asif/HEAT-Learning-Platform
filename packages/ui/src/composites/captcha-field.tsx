"use client";

import * as React from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "../components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../components/field";
import { Input } from "../components/input";
import { Skeleton } from "../components/skeleton";
import { cn } from "../lib/utils";

type CaptchaStatus = "loading" | "ready" | "error";

type CaptchaFieldProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "children" | "type"
> & {
  status: CaptchaStatus;
  svg?: string;
  value: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  supportContact: string;
  supportHref?: string;
  label?: string;
  error?: string;
};

const captchaImageSource = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function CaptchaField({
  status,
  svg,
  value,
  onChange,
  onRefresh,
  supportContact,
  supportHref,
  label = "Security check",
  error,
  className,
  id: idProp,
  ...inputProps
}: CaptchaFieldProps) {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [tracked, setTracked] = React.useState({
    status,
    announcement: status === "loading" ? "Loading security check" : "",
  });
  if (tracked.status !== status) {
    const announcement =
      status === "loading"
        ? "Loading security check"
        : status === "ready" && tracked.announcement !== ""
          ? "New security check loaded"
          : "";
    setTracked({ status, announcement });
  }
  const announcement = tracked.announcement;
  const invalid = error !== undefined && error !== "";

  return (
    <Field data-slot="captcha-field" data-invalid={invalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <div
          className="bg-muted flex h-16 w-48 max-w-full items-center justify-center overflow-hidden rounded-lg border"
          aria-busy={status === "loading"}
        >
          {status === "ready" && svg !== undefined ? (
            <img
              src={captchaImageSource(svg)}
              alt={`${label} image with letters and digits`}
              className="size-full object-contain"
              draggable={false}
            />
          ) : null}
          {status === "loading" ? <Skeleton className="size-full rounded-none" /> : null}
          {status === "error" ? (
            <p role="alert" className="text-destructive px-2 text-center text-sm">
              The security check could not be loaded. Get a new image.
            </p>
          ) : null}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Get a new image"
          disabled={status === "loading"}
          onClick={onRefresh}
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={cn(status === "loading" && "animate-spin")}
          />
        </Button>
      </div>
      <Input
        {...inputProps}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={[hintId, invalid ? errorId : undefined].filter(Boolean).join(" ")}
      />
      <FieldDescription id={hintId}>
        Type the letters and digits in the image. Capital letters do not matter. Cannot read it?{" "}
        {supportHref ? (
          <a href={supportHref} className="text-primary underline underline-offset-4">
            Contact {supportContact}
          </a>
        ) : (
          <>Contact {supportContact}</>
        )}
        .
      </FieldDescription>
      {invalid ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export { CaptchaField, captchaImageSource };
export type { CaptchaFieldProps, CaptchaStatus };
