"use client";

import { isApiError, useQuizCreateQuestion, useQuizUpdateQuestion } from "@heat/api-client";
import type { QuizSummaryDto } from "@heat/api-client";
import {
  questionFormSchema,
  questionRequestOf,
  quizOptionMaxCount,
  quizOptionMinCount,
} from "@heat/contracts";
import type { QuestionFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { correctAfterRemoval, questionFormValuesOf, questionSaveFailedMessage } from "./quiz-copy";

type QuestionFormProps = {
  courseId: string;
  moduleId: string;
  question: {
    id: string;
    text: string;
    explanation: string | null;
    options: ReadonlyArray<{ text: string; isCorrect: boolean }>;
  } | null;
  locked: boolean;
  onSaved: (quiz: QuizSummaryDto) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function QuestionForm({
  courseId,
  moduleId,
  question,
  locked,
  onSaved,
  onCancel,
  onDirtyChange,
}: QuestionFormProps) {
  const create = useQuizCreateQuestion();
  const update = useQuizUpdateQuestion();
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: questionFormValuesOf(question),
  });
  const rows = useFieldArray({ control: form.control, name: "options" });
  const optionsLocked = locked && question !== null;
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: QuestionFormValues) {
    const data = questionRequestOf(values);
    try {
      const saved =
        question === null
          ? await create.mutateAsync({ id: courseId, moduleId, data })
          : await update.mutateAsync({
              id: courseId,
              moduleId,
              questionId: question.id,
              data,
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
      if (isApiError(error) && error.code === "CONTENT_LOCKED") {
        form.setError("root.server", {
          type: "server",
          message: questionSaveFailedMessage(error.code),
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
      {optionsLocked ? (
        <FieldDescription role="note">
          This course is locked. Fix the wording of the question or explanation here. Options and
          the correct answer cannot change. Changes are logged.
        </FieldDescription>
      ) : null}
      <FormField
        name="text"
        label="Question"
        render={({ field, controlProps }) => <Textarea {...field} {...controlProps} />}
      />
      <FormField
        name="correct"
        label="Options"
        description="Select the radio next to the one correct option."
        render={({ field, controlProps }) => (
          <RadioGroup
            id={controlProps.id}
            aria-invalid={controlProps["aria-invalid"]}
            aria-describedby={controlProps["aria-describedby"]}
            value={field.value}
            disabled={optionsLocked}
            onValueChange={(next) => field.onChange(String(next))}
          >
            {rows.fields.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2">
                <div className="pt-8">
                  <RadioGroupItem
                    value={String(index)}
                    aria-label={`Option ${index + 1} is the correct answer`}
                  />
                </div>
                <FormField
                  className="flex-1"
                  name={`options.${index}.text`}
                  label={`Option ${index + 1}`}
                  render={({ field: option, controlProps: optionProps }) => (
                    <Input
                      autoComplete="off"
                      disabled={optionsLocked}
                      {...option}
                      {...optionProps}
                    />
                  )}
                />
                <div className="pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Remove option ${index + 1}`}
                    disabled={optionsLocked || rows.fields.length <= quizOptionMinCount}
                    onClick={() => {
                      form.setValue("correct", correctAfterRemoval(field.value, index), {
                        shouldDirty: true,
                      });
                      rows.remove(index);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
          </RadioGroup>
        )}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={optionsLocked || rows.fields.length >= quizOptionMaxCount}
          onClick={() => rows.append({ text: "" })}
        >
          <PlusIcon data-icon="inline-start" />
          Add option
        </Button>
      </div>
      <FormField
        name="explanation"
        label="Explanation (optional)"
        description="Shown to learners after they answer."
        render={({ field, controlProps }) => <Textarea {...field} {...controlProps} />}
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
