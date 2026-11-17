"use client";

import { useProfileChangeAdminApprove, useProfileChangeAdminReject } from "@heat/api-client";
import { rejectProfileChangeRequestSchema } from "@heat/contracts";
import type { RejectProfileChangeRequest } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  FieldError,
  Form,
  FormField,
  FormMessage,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  approveSummary,
  changeLines,
  decisionFailureMessage,
  rejectSummary,
} from "./profile-changes-copy";
import type { ProfileChangeRow } from "./profile-changes-copy";

export type DecisionTarget = { row: ProfileChangeRow; mode: "approve" | "reject" } | null;

type DecisionSheetProps = {
  target: DecisionTarget;
  onClose: () => void;
  onDecided: (message: string) => void;
};

type DecisionFormProps = {
  row: ProfileChangeRow;
  onDecided: (message: string) => void;
};

function ApproveAction({ row, onDecided }: DecisionFormProps) {
  const approve = useProfileChangeAdminApprove();
  const [failure, setFailure] = useState<string | null>(null);

  async function run() {
    setFailure(null);
    try {
      await approve.mutateAsync({ id: row.id });
      onDecided(`Approved the request from ${row.student.name}.`);
    } catch (error) {
      setFailure(decisionFailureMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      {failure === null ? null : <FieldError>{failure}</FieldError>}
      <Button onClick={() => void run()} disabled={approve.isPending}>
        <CheckIcon data-icon="inline-start" />
        {approve.isPending ? "Approving" : "Approve request"}
      </Button>
    </div>
  );
}

function RejectForm({ row, onDecided }: DecisionFormProps) {
  const reject = useProfileChangeAdminReject();
  const form = useForm<RejectProfileChangeRequest>({
    resolver: zodResolver(rejectProfileChangeRequestSchema),
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: RejectProfileChangeRequest) {
    try {
      await reject.mutateAsync({ id: row.id, data: { reason: values.reason } });
      onDecided(`Rejected the request from ${row.student.name}.`);
    } catch (error) {
      form.setError("root.server", { type: "server", message: decisionFailureMessage(error) });
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit} className="px-4">
      <FormField
        name="reason"
        label="Reason for the student"
        description="Shown to the student on their profile and saved in the audit log."
        render={({ field, controlProps }) => <Textarea {...field} {...controlProps} />}
      />
      <FormMessage />
      <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
        <XIcon data-icon="inline-start" />
        {form.formState.isSubmitting ? "Rejecting" : "Reject request"}
      </Button>
    </Form>
  );
}

export function DecisionSheet({ target, onClose, onDecided }: DecisionSheetProps) {
  const rejecting = target?.mode === "reject";
  const name = target?.row.student.name ?? "";
  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{rejecting ? "Reject change request" : "Approve change request"}</SheetTitle>
          <SheetDescription>
            {rejecting ? rejectSummary(name) : approveSummary(name)}
          </SheetDescription>
        </SheetHeader>
        {target === null ? null : (
          <>
            <div className="flex flex-col gap-3 px-4">
              <ul className="flex flex-col gap-1" aria-label="Requested changes">
                {changeLines(target.row).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {target.row.note === null ? null : (
                <FieldDescription>Note from the student: {target.row.note}</FieldDescription>
              )}
            </div>
            {rejecting ? (
              <RejectForm key={target.row.id} row={target.row} onDecided={onDecided} />
            ) : (
              <ApproveAction key={target.row.id} row={target.row} onDecided={onDecided} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
