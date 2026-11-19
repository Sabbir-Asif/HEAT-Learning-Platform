"use client";

import { usePasswordChangeChange, usePasswordChangeRequestCode } from "@heat/api-client";
import {
  changeStudentPasswordRequestSchema,
  passwordCodeLength,
  passwordMinLength,
} from "@heat/contracts";
import type { ChangeStudentPasswordRequest } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  FieldTitle,
  Form,
  FormField,
  FormMessage,
  Input,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { classifyPasswordFailure } from "./password-failure";

export const unverifiedPasswordMessage = "Verify your email address to change your password.";
export const passwordChangedMessage = "Password changed. Your other sessions were signed out.";

interface PasswordSectionProps {
  emailVerified: boolean;
}

export function PasswordSection({ emailVerified }: PasswordSectionProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [changed, setChanged] = useState(false);
  const requestCode = usePasswordChangeRequestCode();
  const change = usePasswordChangeChange();
  const form = useForm<ChangeStudentPasswordRequest>({
    resolver: zodResolver(changeStudentPasswordRequestSchema),
    defaultValues: { currentPassword: "", code: "", newPassword: "" },
  });

  function fail(error: unknown) {
    const failure = classifyPasswordFailure(error);
    if (failure.field) {
      form.setError(failure.field, { type: "server", message: failure.message });
      form.setFocus(failure.field);
    } else form.setError("root.server", { type: "server", message: failure.message });
  }

  async function sendCode() {
    form.clearErrors("root.server");
    setChanged(false);
    try {
      await requestCode.mutateAsync();
      setCodeSent(true);
    } catch (error) {
      fail(error);
    }
  }

  async function onSubmit(values: ChangeStudentPasswordRequest) {
    setChanged(false);
    try {
      await change.mutateAsync({ data: values });
      form.reset();
      setCodeSent(false);
      setChanged(true);
    } catch (error) {
      fail(error);
    }
  }

  return (
    <section aria-labelledby="profile-password" className="flex flex-col gap-3">
      <FieldTitle id="profile-password" className="sr-only">
        Password
      </FieldTitle>
      {emailVerified ? (
        <Form form={form} onSubmit={onSubmit} aria-label="Change password">
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
          <FormField
            name="code"
            label="Code from your email"
            description={
              codeSent
                ? `We sent a ${passwordCodeLength}-digit code to your email address.`
                : `Request a ${passwordCodeLength}-digit code, then enter it here.`
            }
            render={({ field, controlProps }) => (
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={passwordCodeLength}
                {...field}
                {...controlProps}
              />
            )}
          />
          <FormMessage />
          {changed ? (
            <FieldDescription role="status">{passwordChangedMessage}</FieldDescription>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={requestCode.isPending}
              onClick={() => void sendCode()}
            >
              <MailIcon data-icon="inline-start" />
              {requestCode.isPending ? "Sending" : codeSent ? "Send a new code" : "Email me a code"}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving" : "Change password"}
            </Button>
          </div>
        </Form>
      ) : (
        <FieldDescription>{unverifiedPasswordMessage}</FieldDescription>
      )}
    </section>
  );
}
