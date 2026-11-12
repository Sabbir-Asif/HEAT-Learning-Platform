"use client";

import {
  isApiError,
  useAdminCertificatesReissue,
  useAdminCertificatesRevoke,
} from "@heat/api-client";
import { revokeCertificateRequestSchema } from "@heat/contracts";
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
import { certificateActionCopy } from "./student-copy";
import type { CertificateAction } from "./student-copy";

export type StudentCertificateTarget = {
  action: CertificateAction;
  id: string;
  number: string;
} | null;

type StudentCertificateSheetProps = {
  target: StudentCertificateTarget;
  onClose: () => void;
  onFinished: (action: CertificateAction, number: string) => void;
};

type ReasonValues = { reason: string };

export function StudentCertificateSheet({
  target,
  onClose,
  onFinished,
}: StudentCertificateSheetProps) {
  const revoke = useAdminCertificatesRevoke();
  const reissue = useAdminCertificatesReissue();
  const copy = certificateActionCopy[target?.action ?? "revoke"];
  const form = useForm<ReasonValues>({
    resolver: zodResolver(revokeCertificateRequestSchema),
    defaultValues: { reason: "" },
  });

  function close() {
    form.reset();
    onClose();
  }

  async function onSubmit(values: ReasonValues) {
    if (target === null) return;
    try {
      const request = { id: target.id, data: { reason: values.reason } };
      if (target.action === "revoke") await revoke.mutateAsync(request);
      else await reissue.mutateAsync(request);
      onFinished(target.action, target.number);
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
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description(target?.number ?? "")}</SheetDescription>
        </SheetHeader>
        <Form form={form} onSubmit={onSubmit} className="px-4">
          <FormMessage />
          <FormField
            name="reason"
            label="Reason"
            description="Saved with the audit log."
            render={({ field, controlProps }) => <Textarea {...field} {...controlProps} />}
          />
          <Button
            type="submit"
            variant={copy.destructive ? "destructive" : "default"}
            disabled={form.formState.isSubmitting}
          >
            {copy.confirm}
          </Button>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
