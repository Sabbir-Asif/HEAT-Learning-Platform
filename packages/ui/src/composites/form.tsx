"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "../components/field";
import { cn } from "../lib/utils";

type FormProps<T extends FieldValues> = Omit<React.ComponentProps<"form">, "onSubmit"> & {
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
};

function Form<T extends FieldValues>({
  form,
  onSubmit,
  className,
  children,
  ...props
}: FormProps<T>) {
  const submitting = React.useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    if (submitting.current) {
      event.preventDefault();
      return;
    }
    submitting.current = true;
    try {
      await form.handleSubmit(onSubmit)(event);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <FormProvider {...form}>
      <form
        data-slot="form"
        noValidate
        onSubmit={submit}
        className={cn("flex flex-col gap-5", className)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}

type FormControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type FormFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  name: N;
  label: string;
  description?: string;
  className?: string;
  render: (args: {
    field: ControllerRenderProps<T, N>;
    controlProps: FormControlProps;
  }) => React.ReactElement;
};

function FormField<T extends FieldValues, N extends FieldPath<T> = FieldPath<T>>({
  name,
  label,
  description,
  className,
  render,
}: FormFieldProps<T, N>) {
  const { control } = useFormContext<T>();
  const id = React.useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = fieldState.invalid;
        const describedBy =
          [description ? descriptionId : undefined, fieldState.error?.message ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined;
        return (
          <Field
            data-slot="form-field"
            data-field-name={name}
            data-invalid={invalid}
            className={className}
          >
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {render({
              field,
              controlProps: { id, "aria-invalid": invalid, "aria-describedby": describedBy },
            })}
            {description ? (
              <FieldDescription id={descriptionId}>{description}</FieldDescription>
            ) : null}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<"div">) {
  const {
    formState: { errors },
  } = useFormContext();
  const message = errors.root?.server?.message;

  if (!message) return null;

  return (
    <div
      data-slot="form-message"
      role="alert"
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {message}
    </div>
  );
}

export { Form, FormField, FormMessage };
export type { FormControlProps, FormFieldProps, FormProps };
