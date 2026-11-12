"use client";

import { usePasswordResetForgotPassword } from "@heat/api-client";
import { forgotPasswordRequestSchema } from "@heat/contracts";
import type { ForgotPasswordRequest } from "@heat/contracts";
import {
  Button,
  CaptchaField,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { supportEmail } from "../enroll/support-contact";
import { classifySubmitError } from "../enroll/submit-error";
import { useCaptcha } from "../enroll/use-captcha";

export const forgotAcceptedMessage =
  "If this address belongs to a verified account, a reset link is on its way. The link works for one hour.";

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "", captchaId: "", captchaAnswer: "" },
  });
  const captcha = useCaptcha();
  const forgot = usePasswordResetForgotPassword();
  const challengeId = captcha.challenge?.id;

  useEffect(() => {
    form.setValue("captchaId", challengeId ?? "");
  }, [form, challengeId]);

  async function onSubmit(values: ForgotPasswordRequest) {
    try {
      await forgot.mutateAsync({ data: values });
    } catch (error) {
      const failure = classifySubmitError(error);
      if (failure.refreshCaptcha) {
        form.setValue("captchaAnswer", "");
        captcha.refresh();
      }
      if (failure.payload) applyServerError(form, failure.payload);
      else if (failure.fieldPath === "captchaAnswer") {
        form.setError("captchaAnswer", { type: "server", message: failure.message });
        form.setFocus("captchaAnswer");
      } else form.setError("root.server", { type: "server", message: failure.message });
    }
  }

  if (forgot.isSuccess) {
    return (
      <div className="flex flex-col gap-3">
        <FieldDescription role="status">{forgotAcceptedMessage}</FieldDescription>
        <div>
          <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      <FormField
        name="email"
        label="University email"
        description="We send a reset link only to verified addresses."
        render={({ field, controlProps }) => (
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@du.ac.bd"
            {...field}
            {...controlProps}
          />
        )}
      />
      <Controller
        control={form.control}
        name="captchaAnswer"
        render={({ field }) => (
          <CaptchaField
            status={captcha.status}
            svg={captcha.challenge?.svg}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            onRefresh={() => {
              field.onChange("");
              captcha.refresh();
            }}
            supportContact={supportEmail}
            supportHref={`mailto:${supportEmail}`}
            error={errors.captchaAnswer?.message ?? errors.captchaId?.message}
          />
        )}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        <MailIcon data-icon="inline-start" />
        {isSubmitting ? "Sending" : "Send reset link"}
      </Button>
    </Form>
  );
}
