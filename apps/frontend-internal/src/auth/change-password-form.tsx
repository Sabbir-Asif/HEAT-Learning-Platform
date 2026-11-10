"use client";

import { isApiError, useAdminAccountChangePassword } from "@heat/api-client";
import { changePasswordRequestSchema, passwordMinLength } from "@heat/contracts";
import type { ChangePasswordRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FieldDescription,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

export const wrongCurrentPasswordMessage = "The current password is not correct.";
export const breachedPasswordMessage =
  "This password has appeared in a data breach. Choose a different one.";

export interface ChangePasswordFormProps {
  forced: boolean;
}

export function ChangePasswordForm({ forced }: ChangePasswordFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const changePassword = useAdminAccountChangePassword();
  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  async function onSubmit(values: ChangePasswordRequest) {
    setSaved(false);
    try {
      await changePassword.mutateAsync({ data: values });
      if (forced) {
        window.location.assign("/");
        return;
      }
      form.reset();
      setSaved(true);
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.code === "INVALID_CREDENTIALS") {
        form.setError("currentPassword", { type: "server", message: wrongCurrentPasswordMessage });
        return;
      }
      if (isApiError(error) && error.code === "PASSWORD_BREACHED") {
        form.setError("newPassword", { type: "server", message: breachedPasswordMessage });
        return;
      }
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
    <Form form={form} onSubmit={onSubmit} className="max-w-md">
      <FormMessage />
      {saved ? (
        <FieldDescription role="status">
          Password changed. Your other sessions were signed out.
        </FieldDescription>
      ) : null}
      <FormField
        name="currentPassword"
        label="Current password"
        render={({ field, controlProps }) => (
          <Input type="password" autoComplete="current-password" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="newPassword"
        label="New password"
        description={`At least ${passwordMinLength} characters. It must not appear in a known data breach.`}
        render={({ field, controlProps }) => (
          <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
        )}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        <KeyRoundIcon data-icon="inline-start" />
        {form.formState.isSubmitting ? "Saving" : "Change password"}
      </Button>
    </Form>
  );
}
