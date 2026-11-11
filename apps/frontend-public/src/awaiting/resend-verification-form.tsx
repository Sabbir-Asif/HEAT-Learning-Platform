"use client";

import { useVerificationResend } from "@heat/api-client";
import { verificationResendRequestSchema } from "@heat/contracts";
import type { VerificationResendRequest } from "@heat/contracts";
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
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { supportEmail } from "../enroll/support-contact";
import { classifySubmitError } from "../enroll/submit-error";
import { useCaptcha } from "../enroll/use-captcha";

export const resendAcceptedMessage =
  "If this address is awaiting verification, a new link is on its way.";

export interface ResendVerificationFormProps {
  defaultEmail?: string;
}

export function ResendVerificationForm({ defaultEmail = "" }: ResendVerificationFormProps) {
  const form = useForm<VerificationResendRequest>({
    resolver: zodResolver(verificationResendRequestSchema),
    defaultValues: { email: defaultEmail, captchaId: "", captchaAnswer: "" },
  });
  const captcha = useCaptcha();
  const resend = useVerificationResend();
  const challengeId = captcha.challenge?.id;

  useEffect(() => {
    form.setValue("captchaId", challengeId ?? "");
  }, [form, challengeId]);

  async function onSubmit(values: VerificationResendRequest) {
    try {
      await resend.mutateAsync({ data: values });
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

  if (resend.isSuccess) {
    return <FieldDescription role="status">{resendAcceptedMessage}</FieldDescription>;
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField
        name="email"
        label="Email"
        description="We send a new verification link to this address."
        render={({ field, controlProps }) => (
          <Input type="email" autoComplete="email" inputMode="email" {...field} {...controlProps} />
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
      <FormMessage />
      <div>
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          <MailIcon data-icon="inline-start" />
          {isSubmitting ? "Sending" : "Send a new link"}
        </Button>
      </div>
    </Form>
  );
}
