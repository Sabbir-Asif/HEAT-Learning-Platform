"use client";

import { isApiError, useModulesCreate, useModulesUpdate } from "@heat/api-client";
import type { ModuleSummaryDto } from "@heat/api-client";
import { moduleFormSchema, moduleObjectiveMaxCount } from "@heat/contracts";
import type { ModuleFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  FieldTitle,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { moduleFormValuesOf, moduleLockedMessage, moduleRequestOf } from "./modules-copy";

type ModuleFormProps = {
  courseId: string;
  module: ModuleSummaryDto | null;
  locked: boolean;
  onSaved: (module: ModuleSummaryDto) => void | Promise<void>;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ModuleForm({
  courseId,
  module,
  locked,
  onSaved,
  onCancel,
  onDirtyChange,
}: ModuleFormProps) {
  const create = useModulesCreate();
  const update = useModulesUpdate();
  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: moduleFormValuesOf(module),
  });
  const rows = useFieldArray({ control: form.control, name: "objectives" });

  const { reset } = form;
  const { isDirty } = form.formState;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const shownId = useRef(module?.id);
  useEffect(() => {
    if (dirtyRef.current && shownId.current === module?.id) return;
    shownId.current = module?.id;
    reset(moduleFormValuesOf(module));
  }, [reset, module]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: ModuleFormValues) {
    const data = moduleRequestOf(values);
    try {
      const saved =
        module === null
          ? await create.mutateAsync({ id: courseId, data })
          : await update.mutateAsync({ id: courseId, moduleId: module.id, data });
      reset(moduleFormValuesOf(saved));
      await onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.code === "RATE_LIMITED") {
        form.setError("root.server", {
          type: "server",
          message: rateLimitedMessage(error.retryAfterSeconds),
        });
        return;
      }
      if (isApiError(error)) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
        return;
      }
      form.setError("root.server", { type: "server", message: formErrorCopy.INTERNAL });
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {locked ? <FieldDescription role="note">{moduleLockedMessage}</FieldDescription> : null}
      <FormField
        name="title"
        label="Title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <div className="flex flex-col gap-3">
        <FieldTitle>Learning objectives</FieldTitle>
        {rows.fields.length === 0 ? <FieldDescription>No objectives yet.</FieldDescription> : null}
        {rows.fields.map((row, index) => (
          <div key={row.id} className="flex items-start gap-2">
            <FormField
              className="flex-1"
              name={`objectives.${index}.text`}
              label={`Objective ${index + 1}`}
              render={({ field, controlProps }) => (
                <Input autoComplete="off" {...field} {...controlProps} />
              )}
            />
            <div className="flex gap-1 pt-6">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Move objective ${index + 1} up`}
                disabled={index === 0}
                onClick={() => rows.move(index, index - 1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Move objective ${index + 1} down`}
                disabled={index === rows.fields.length - 1}
                onClick={() => rows.move(index, index + 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Remove objective ${index + 1}`}
                onClick={() => rows.remove(index)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={rows.fields.length >= moduleObjectiveMaxCount}
            onClick={() => rows.append({ text: "" })}
          >
            <PlusIcon data-icon="inline-start" />
            Add objective
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
