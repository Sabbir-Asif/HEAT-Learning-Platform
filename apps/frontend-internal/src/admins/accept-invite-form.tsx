"use client";

import { isApiError, useAdminInvitationAccept } from "@heat/api-client";
import { acceptInviteRequestSchema, passwordMinLength } from "@heat/contracts";
import type { AcceptInviteRequest } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogInIcon, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { breachedPasswordMessage } from "../auth/change-password-form";

const passwordOnlySchema = acceptInviteRequestSchema.pick({ password: true });

type PasswordOnly = Pick<AcceptInviteRequest, "password">;

export interface AcceptInviteFormProps {
  token: string;
  email: string;
  onUnusable: (reason: "expired" | "invalid") => void;
}

export function AcceptInviteForm({ token, email, onUnusable }: AcceptInviteFormProps) {
  const [done, setDone] = useState(false);
  const accept = useAdminInvitationAccept();
  const form = useForm<PasswordOnly>({
    resolver: zodResolver(passwordOnlySchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: PasswordOnly) {
    try {
      await accept.mutateAsync({ data: { token, password: values.password } });
      setDone(true);
    } catch (error) {
      if (isApiError(error) && error.code === "INVITATION_EXPIRED") return onUnusable("expired");
      if (isApiError(error) && error.code === "INVITATION_INVALID") return onUnusable("invalid");
      if (isApiError(error) && error.code === "PASSWORD_BREACHED") {
        form.setError("password", { type: "server", message: breachedPasswordMessage });
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

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FieldDescription role="status">
          Your password is set. Sign in with {email} to open the console.
        </FieldDescription>
        <Button size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
          <LogInIcon data-icon="inline-start" />
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      <FieldDescription>Setting a password for {email}.</FieldDescription>
      <FormField
        name="password"
        label="Password"
        description={`At least ${passwordMinLength} characters. It must not appear in a known data breach.`}
        render={({ field, controlProps }) => (
          <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
        )}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        <UserCheckIcon data-icon="inline-start" />
        {form.formState.isSubmitting ? "Saving" : "Set password"}
      </Button>
    </Form>
  );
}
