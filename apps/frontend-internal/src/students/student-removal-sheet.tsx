"use client";

import {
  isApiError,
  useEnrollmentRemovalReinstate,
  useEnrollmentRemovalRemove,
} from "@heat/api-client";
import { reinstateEnrollmentRequestSchema, removeEnrollmentRequestSchema } from "@heat/contracts";
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

export type StudentRemovalTarget = {
  action: "remove" | "reinstate";
  id: string;
  name: string;
} | null;

type StudentRemovalSheetProps = {
  target: StudentRemovalTarget;
  onClose: () => void;
  onFinished: (action: "remove" | "reinstate", name: string) => void;
};

type ReasonValues = { reason?: string | undefined };

export function StudentRemovalSheet({ target, onClose, onFinished }: StudentRemovalSheetProps) {
  const remove = useEnrollmentRemovalRemove();
  const reinstate = useEnrollmentRemovalReinstate();
  const removing = target?.action !== "reinstate";
  const form = useForm<ReasonValues>({
    resolver: zodResolver(
      removing ? removeEnrollmentRequestSchema : reinstateEnrollmentRequestSchema,
    ),
    defaultValues: { reason: "" },
  });

  function close() {
    form.reset();
    onClose();
  }

  async function onSubmit(values: ReasonValues) {
    if (target === null) return;
    try {
      if (target.action === "remove") {
        await remove.mutateAsync({ id: target.id, data: { reason: values.reason ?? "" } });
      } else {
        await reinstate.mutateAsync({
          id: target.id,
          data:
            values.reason === undefined || values.reason === "" ? {} : { reason: values.reason },
        });
      }
      onFinished(target.action, target.name);
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
          <SheetTitle>{removing ? "Remove student" : "Reinstate student"}</SheetTitle>
          <SheetDescription>
            {removing
              ? `${target?.name ?? "The student"} loses access to the course and sees the reason you give. Progress, quiz history and any certificate are kept. Video playback stops within 10 minutes.`
              : `${target?.name ?? "The student"} gets back the access they had before the removal, with progress unchanged.`}
          </SheetDescription>
        </SheetHeader>
        <Form form={form} onSubmit={onSubmit} className="px-4">
          <FormMessage />
          <FormField
            name="reason"
            label={removing ? "Reason" : "Reason (optional)"}
            description="Saved with the decision and the audit log."
            render={({ field, controlProps }) => (
              <Textarea {...field} value={field.value ?? ""} {...controlProps} />
            )}
          />
          <Button
            type="submit"
            variant={removing ? "destructive" : "default"}
            disabled={form.formState.isSubmitting}
          >
            {removing ? "Remove student" : "Reinstate student"}
          </Button>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
