"use client";

import { useEnrollmentApprovalApproveMany } from "@heat/api-client";
import { approvalReasonPresets, approveEnrollmentRequestSchema } from "@heat/contracts";
import type { ApproveEnrollmentRequest, BulkApprovalResponse } from "@heat/contracts";
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
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  approvalFailureMessage,
  approvalSummaryText,
  approveLabel,
  selectionLabel,
} from "./approval-copy";

export type ApproveTarget = { ids: string[]; labels: Record<string, string> } | null;

type ApproveSheetProps = {
  target: ApproveTarget;
  onClose: () => void;
  onFinished: (summary: BulkApprovalResponse) => void;
};

const noPreset = "none";
const presetItems = [
  { value: noPreset, label: "No preset" },
  ...approvalReasonPresets.map((preset) => ({ value: preset, label: preset })),
];

export function ApproveSheet({ target, onClose, onFinished }: ApproveSheetProps) {
  const approve = useEnrollmentApprovalApproveMany();
  const [summary, setSummary] = useState<BulkApprovalResponse | null>(null);
  const form = useForm<ApproveEnrollmentRequest>({
    resolver: zodResolver(approveEnrollmentRequestSchema),
    defaultValues: { reason: "" },
  });

  function close() {
    setSummary(null);
    form.reset();
    onClose();
  }

  async function onSubmit(values: ApproveEnrollmentRequest) {
    if (target === null) return;
    try {
      const result = await approve.mutateAsync({
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
          <SheetTitle>{summary === null ? "Approve requests" : "Approval result"}</SheetTitle>
          <SheetDescription>
            {summary === null
              ? `${selectionLabel(count)}. Approving gives each student access to module 1 of the current course version.`
              : approvalSummaryText(summary.succeeded.length, summary.failed.length)}
          </SheetDescription>
        </SheetHeader>
        {summary === null ? (
          <Form form={form} onSubmit={onSubmit} className="px-4">
            <FormMessage />
            <Field>
              <FieldLabel id="approval-preset">Preset reason</FieldLabel>
              <Select
                items={presetItems}
                value={noPreset}
                onValueChange={(value) =>
                  form.setValue("reason", value === null || value === noPreset ? "" : value, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger aria-labelledby="approval-preset" className="w-full">
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
              description="Saved with the decision and the audit log."
              render={({ field, controlProps }) => (
                <Textarea {...field} value={field.value ?? ""} {...controlProps} />
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <CheckIcon data-icon="inline-start" />
              {form.formState.isSubmitting ? "Approving" : approveLabel(count)}
            </Button>
          </Form>
        ) : (
          <div className="flex flex-col gap-3 px-4">
            {summary.failed.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label="Requests not approved">
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
