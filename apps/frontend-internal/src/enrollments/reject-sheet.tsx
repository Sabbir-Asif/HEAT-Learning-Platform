"use client";

import { useEnrollmentApprovalRejectMany } from "@heat/api-client";
import { rejectEnrollmentRequestSchema, rejectionReasonPresets } from "@heat/contracts";
import type { BulkRejectionResponse, RejectEnrollmentRequest } from "@heat/contracts";
import {
  Button,
  Field,
  FieldLabel,
  Form,
  FormField,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  formErrorCopy,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  approvalFailureMessage,
  rejectLabel,
  rejectionSummaryText,
  selectionLabel,
} from "./approval-copy";

export type RejectTarget = { ids: string[]; labels: Record<string, string> } | null;

type RejectSheetProps = {
  target: RejectTarget;
  onClose: () => void;
  onFinished: (summary: BulkRejectionResponse) => void;
};

const noPreset = "none";
const presetItems = [
  { value: noPreset, label: "No preset" },
  ...rejectionReasonPresets.map((preset) => ({ value: preset, label: preset })),
];

export function RejectSheet({ target, onClose, onFinished }: RejectSheetProps) {
  const reject = useEnrollmentApprovalRejectMany();
  const [summary, setSummary] = useState<BulkRejectionResponse | null>(null);
  const form = useForm<RejectEnrollmentRequest>({
    resolver: zodResolver(rejectEnrollmentRequestSchema),
    defaultValues: { reason: "" },
  });

  function close() {
    setSummary(null);
    form.reset();
    onClose();
  }

  async function onSubmit(values: RejectEnrollmentRequest) {
    if (target === null) return;
    try {
      const result = await reject.mutateAsync({
        data: {
          ids: target.ids,
          ...(values.reason === undefined ? {} : { reason: values.reason }),
        },
      });
      setSummary(result);
      onFinished(result);
    } catch {
      form.setError("root.server", { type: "server", message: formErrorCopy.INTERNAL });
    }
  }

  const count = target?.ids.length ?? 0;

  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{summary === null ? "Reject requests" : "Rejection result"}</SheetTitle>
          <SheetDescription>
            {summary === null
              ? `${selectionLabel(count)}. Rejecting removes each request, and the student's account too when it has no other approved or completed course. The email can then register again.`
              : rejectionSummaryText(summary.succeeded.length, summary.failed.length)}
          </SheetDescription>
        </SheetHeader>
        {summary === null ? (
          <Form form={form} onSubmit={onSubmit} className="px-4">
            <FormMessage />
            <Field>
              <FieldLabel id="rejection-preset">Preset reason</FieldLabel>
              <Select
                items={presetItems}
                value={noPreset}
                onValueChange={(value) =>
                  form.setValue("reason", value === null || value === noPreset ? "" : value, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger aria-labelledby="rejection-preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FormField
              name="reason"
              label="Reason (optional)"
              description="Saved with the decision and the audit log, and included in the email to the student."
              render={({ field, controlProps }) => (
                <Textarea {...field} value={field.value ?? ""} {...controlProps} />
              )}
            />
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              <XIcon data-icon="inline-start" />
              {form.formState.isSubmitting ? "Rejecting" : rejectLabel(count)}
            </Button>
          </Form>
        ) : (
          <div className="flex flex-col gap-3 px-4">
            {summary.failed.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label="Requests not rejected">
                {summary.failed.map((failure) => (
                  <li key={failure.id}>
                    <strong>{target?.labels[failure.id] ?? failure.id}</strong>
                    {": "}
                    {approvalFailureMessage(failure.code)}
                  </li>
                ))}
              </ul>
            ) : null}
            <SheetFooter>
              <Button onClick={close}>Done</Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
