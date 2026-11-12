"use client";

import { isApiError, useAttemptGrantGrant } from "@heat/api-client";
import { grantAttemptRequestSchema } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
  formErrorCopy,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { attemptGrantDescription } from "./student-copy";

export type StudentAttemptGrantTarget = {
  enrollmentId: string;
  quizId: string;
  studentName: string;
  moduleTitle: string;
} | null;

type StudentAttemptGrantSheetProps = {
  target: StudentAttemptGrantTarget;
  onClose: () => void;
  onFinished: (studentName: string, moduleTitle: string) => void;
};

type ReasonValues = { reason?: string | undefined };

export function StudentAttemptGrantSheet({
  target,
  onClose,
  onFinished,
}: StudentAttemptGrantSheetProps) {
  const grant = useAttemptGrantGrant();
  const form = useForm<ReasonValues>({
    resolver: zodResolver(grantAttemptRequestSchema),
    defaultValues: { reason: "" },
  });

  function close() {
    form.reset();
    onClose();
  }

  async function onSubmit(values: ReasonValues) {
    if (target === null) return;
    try {
      await grant.mutateAsync({
        id: target.enrollmentId,
        quizId: target.quizId,
        data: values.reason === undefined || values.reason === "" ? {} : { reason: values.reason },
      });
      onFinished(target.studentName, target.moduleTitle);
      close();
    } catch (error) {
      const message =
        isApiError(error) && error.code in formErrorCopy
          ? formErrorCopy[error.code as keyof typeof formErrorCopy]
          : formErrorCopy.INTERNAL;
      form.setError("root.server", { type: "server", message });
    }
  }

  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Grant an extra attempt</SheetTitle>
          <SheetDescription>
            {attemptGrantDescription(
              target?.studentName ?? "The student",
              target?.moduleTitle ?? "this module",
            )}
          </SheetDescription>
        </SheetHeader>
        <Form form={form} onSubmit={onSubmit} className="px-4">
          <FormMessage />
          <FormField
            name="reason"
            label="Reason (optional)"
            description="Saved with the audit log entry."
            render={({ field, controlProps }) => (
              <Textarea {...field} value={field.value ?? ""} {...controlProps} />
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Grant extra attempt
          </Button>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
