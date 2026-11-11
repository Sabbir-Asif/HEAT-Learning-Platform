"use client";

import { isApiError, useLessonSectionsCreate, useLessonSectionsUpdate } from "@heat/api-client";
import type { ModuleSummaryDto } from "@heat/api-client";
import { lessonSectionRequestSchema } from "@heat/contracts";
import type { LessonSectionRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

type SectionFormProps = {
  courseId: string;
  moduleId: string;
  section: { id: string; title: string } | null;
  onSaved: (module: ModuleSummaryDto) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function SectionForm({
  courseId,
  moduleId,
  section,
  onSaved,
  onCancel,
  onDirtyChange,
}: SectionFormProps) {
  const create = useLessonSectionsCreate();
  const update = useLessonSectionsUpdate();
  const form = useForm<LessonSectionRequest>({
    resolver: zodResolver(lessonSectionRequestSchema),
    defaultValues: { title: section?.title ?? "" },
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: LessonSectionRequest) {
    try {
      const saved =
        section === null
          ? await create.mutateAsync({ id: courseId, moduleId, data: values })
          : await update.mutateAsync({
              id: courseId,
              moduleId,
              sectionId: section.id,
              data: values,
            });
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
      <FormField
        name="title"
        label="Section title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}
