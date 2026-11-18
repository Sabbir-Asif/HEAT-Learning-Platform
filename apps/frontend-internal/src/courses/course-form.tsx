"use client";

import { isApiError, useCoursesCreate, useCoursesUpdate } from "@heat/api-client";
import type { CourseSummaryDto } from "@heat/api-client";
import { courseDescriptionMaxLength, courseFormSchema } from "@heat/contracts";
import type { CourseFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  Textarea,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { slugFromTitle } from "./course-slug";
import { courseLockedMessage, courseSlugTakenMessage } from "./courses-copy";

type CourseFormProps = {
  course: CourseSummaryDto | null;
  onSaved: (course: CourseSummaryDto) => void | Promise<void>;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const valuesOf = (course: CourseSummaryDto | null): CourseFormValues => ({
  title: course?.title ?? "",
  slug: course?.slug ?? "",
  description: course?.description ?? "",
});

export function CourseForm({ course, onSaved, onCancel, onDirtyChange }: CourseFormProps) {
  const create = useCoursesCreate();
  const update = useCoursesUpdate();
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: valuesOf(course),
  });
  const locked = course?.lockedAt != null;

  const { reset } = form;
  const { isDirty } = form.formState;
  useEffect(() => {
    reset(valuesOf(course));
  }, [reset, course]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const title = form.watch("title");
  const slugEdited = form.formState.dirtyFields.slug === true;
  const { setValue } = form;
  useEffect(() => {
    if (course !== null || slugEdited) return;
    setValue("slug", slugFromTitle(title), { shouldValidate: title !== "" });
  }, [course, slugEdited, title, setValue]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function onSubmit(values: CourseFormValues) {
    const data = {
      title: values.title,
      slug: values.slug,
      description: values.description === "" ? null : values.description,
      thumbnailAssetId: course?.thumbnailAssetId ?? null,
    };
    try {
      const saved =
        course === null
          ? await create.mutateAsync({ data })
          : await update.mutateAsync({ id: course.id, data });
      await onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.code === "COURSE_SLUG_TAKEN") {
        form.setError("slug", { type: "server", message: courseSlugTakenMessage });
        return;
      }
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
      {locked ? <FieldDescription role="note">{courseLockedMessage}</FieldDescription> : null}
      <FormField
        name="title"
        label="Title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" readOnly={locked} {...field} {...controlProps} />
        )}
      />
      <FormField
        name="slug"
        label="Slug"
        description={
          course === null
            ? "Filled in from the title. Edit it to change the course address."
            : "Lowercase letters, digits and hyphens. It appears in the course address."
        }
        render={({ field, controlProps }) => (
          <Input autoComplete="off" readOnly={locked} {...field} {...controlProps} />
        )}
      />
      <FormField
        name="description"
        label="Description"
        description={`${form.watch("description").length} of ${courseDescriptionMaxLength} characters.`}
        render={({ field, controlProps }) => <Textarea rows={6} {...field} {...controlProps} />}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Saving"
            : course === null
              ? "Create course"
              : "Save changes"}
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
