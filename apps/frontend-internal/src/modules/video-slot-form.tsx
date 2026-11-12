"use client";

import { isApiError, useVideoSlotsCreate, useVideoSlotsUpdate } from "@heat/api-client";
import type { VideoSlotListResponseDto } from "@heat/api-client";
import { updateVideoSlotRequestSchema } from "@heat/contracts";
import type { UpdateVideoSlotRequest } from "@heat/contracts";
import {
  Button,
  Checkbox,
  Field,
  FieldLabel,
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

type VideoSlotFormProps = {
  courseId: string;
  moduleId: string;
  slot: { id: string; title: string; required: boolean } | null;
  locked: boolean;
  onSaved: (list: VideoSlotListResponseDto) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function VideoSlotForm({
  courseId,
  moduleId,
  slot,
  locked,
  onSaved,
  onCancel,
  onDirtyChange,
}: VideoSlotFormProps) {
  const create = useVideoSlotsCreate();
  const update = useVideoSlotsUpdate();
  const form = useForm<UpdateVideoSlotRequest>({
    resolver: zodResolver(updateVideoSlotRequestSchema),
    defaultValues: { title: slot?.title ?? "", required: slot?.required ?? true },
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: UpdateVideoSlotRequest) {
    try {
      const saved =
        slot === null
          ? await create.mutateAsync({ id: courseId, moduleId, data: values })
          : await update.mutateAsync({ id: courseId, moduleId, videoId: slot.id, data: values });
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
        label="Video title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="required"
        label="Required"
        description="Learners must watch a required video to complete the module."
        render={({ field, controlProps }) => (
          <Field orientation="horizontal">
            <Checkbox
              id={controlProps.id}
              disabled={locked && slot !== null}
              checked={field.value}
              onCheckedChange={(next) => field.onChange(next === true)}
            />
            <FieldLabel htmlFor={controlProps.id}>Learners must watch this video</FieldLabel>
          </Field>
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
