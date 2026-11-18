"use client";

import { isApiError, useAdminQuizSettingsUpdate } from "@heat/api-client";
import type { AdminQuizSettingsResponseDto } from "@heat/api-client";
import { quizSettingsRequestSchema } from "@heat/contracts";
import type { QuizSettingsRequest } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { attemptLimitOf } from "../modules/quiz-copy";
import { quizSettingsFailedMessage } from "./settings-copy";

type QuizSettingsFormProps = {
  settings: AdminQuizSettingsResponseDto;
  onSaved: () => void | Promise<void>;
};

const display = (value: number | null): string => (value === null ? "" : String(value));

export function QuizSettingsForm({ settings, onSaved }: QuizSettingsFormProps) {
  const save = useAdminQuizSettingsUpdate();
  const form = useForm<QuizSettingsRequest>({
    resolver: zodResolver(quizSettingsRequestSchema),
    defaultValues: { attemptLimit: settings.attemptLimit },
  });
  const [problem, setProblem] = useState<string | null>(null);

  async function onSubmit(values: QuizSettingsRequest) {
    setProblem(null);
    try {
      await save.mutateAsync({ data: values });
      form.reset(values);
      await onSaved();
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.fields?.length) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
      }
      setProblem(
        isApiError(error) ? quizSettingsFailedMessage(error.code) : formErrorCopy.INTERNAL,
      );
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <FormField
        name="attemptLimit"
        label="Default attempt limit"
        description="Leave empty for unlimited attempts. New quizzes start with this limit; each quiz can still set its own, and existing quizzes keep theirs."
        render={({ field, controlProps }) => (
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Unlimited"
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={display(field.value)}
            onChange={(event) => field.onChange(attemptLimitOf(event.target.value))}
            {...controlProps}
          />
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </Form>
  );
}
