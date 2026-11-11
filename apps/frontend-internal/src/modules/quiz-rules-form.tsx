"use client";

import { isApiError, useQuizUpdateRules } from "@heat/api-client";
import type { QuizSummaryDto } from "@heat/api-client";
import { quizRulesRequestSchema } from "@heat/contracts";
import type { QuizRulesRequest } from "@heat/contracts";
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
import { attemptLimitOf, numberOf } from "./quiz-copy";

type QuizRulesFormProps = {
  courseId: string;
  moduleId: string;
  rules: QuizRulesRequest;
  locked: boolean;
  onSaved: (quiz: QuizSummaryDto) => void | Promise<void>;
};

const display = (value: number | null): string =>
  value === null || Number.isNaN(value) ? "" : String(value);

export function QuizRulesForm({ courseId, moduleId, rules, locked, onSaved }: QuizRulesFormProps) {
  const update = useQuizUpdateRules();
  const form = useForm<QuizRulesRequest>({
    resolver: zodResolver(quizRulesRequestSchema),
    defaultValues: rules,
  });
  const { reset } = form;

  useEffect(() => {
    reset(rules);
  }, [reset, rules]);

  async function onSubmit(values: QuizRulesRequest) {
    try {
      await onSaved(await update.mutateAsync({ id: courseId, moduleId, data: values }));
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
        name="passMarkPercent"
        label="Pass mark (percent)"
        description="The score a learner needs to pass, from 1 to 100."
        render={({ field, controlProps }) => (
          <Input
            type="number"
            inputMode="numeric"
            disabled={locked}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={display(field.value)}
            onChange={(event) => field.onChange(numberOf(event.target.value))}
            {...controlProps}
          />
        )}
      />
      <FormField
        name="attemptLimit"
        label="Attempt limit"
        description="Leave empty for unlimited attempts."
        render={({ field, controlProps }) => (
          <Input
            type="number"
            inputMode="numeric"
            disabled={locked}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={display(field.value)}
            onChange={(event) => field.onChange(attemptLimitOf(event.target.value))}
            {...controlProps}
          />
        )}
      />
      <FormField
        name="waitMinutes"
        label="Wait between attempts (minutes)"
        description="How long a learner waits after a failed attempt."
        render={({ field, controlProps }) => (
          <Input
            type="number"
            inputMode="numeric"
            disabled={locked}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={display(field.value)}
            onChange={(event) => field.onChange(numberOf(event.target.value))}
            {...controlProps}
          />
        )}
      />
      <div>
        <Button type="submit" disabled={locked || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save rules"}
        </Button>
      </div>
    </Form>
  );
}
