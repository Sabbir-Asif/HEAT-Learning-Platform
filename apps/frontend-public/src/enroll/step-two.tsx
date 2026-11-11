"use client";

import { useEnrollmentSubmit } from "@heat/api-client";
import { enrollmentStepOneSchema, enrollmentStepTwoSchema } from "@heat/contracts";
import type { EnrollmentStepTwo, EnrollmentStepTwoInput } from "@heat/contracts";
import {
  Button,
  CaptchaField,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  PageHeader,
  applyServerError,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { readStepOne } from "./step-one-store";
import { classifySubmitError } from "./submit-error";
import { useCaptcha } from "./use-captcha";

export const supportEmail = "support@heat.du.ac.bd";

const emptyStepTwo: EnrollmentStepTwoInput = {
  email: "",
  password: "",
  confirmPassword: "",
  captchaId: "",
  captchaAnswer: "",
};

interface StepTwoProps {
  courseSlug: string;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export function StepTwo({ courseSlug, onBack, onSuccess }: StepTwoProps) {
  const form = useForm<EnrollmentStepTwoInput, unknown, EnrollmentStepTwo>({
    resolver: zodResolver(enrollmentStepTwoSchema),
    defaultValues: emptyStepTwo,
  });
  const captcha = useCaptcha();
  const submit = useEnrollmentSubmit();
  const challengeId = captcha.challenge?.id;

  useEffect(() => {
    form.setValue("captchaId", challengeId ?? "");
  }, [form, challengeId]);

  async function onSubmit(values: EnrollmentStepTwo) {
    const stepOne = enrollmentStepOneSchema.safeParse(readStepOne());
    if (!stepOne.success) {
      onBack();
      return;
    }
    try {
      await submit.mutateAsync({ data: { ...stepOne.data, ...values, courseSlug } });
    } catch (error) {
      const failure = classifySubmitError(error);
      if (failure.refreshCaptcha) {
        form.setValue("captchaAnswer", "");
        captcha.refresh();
      }
      if (failure.payload) applyServerError(form, failure.payload);
      else if (failure.fieldPath) {
        form.setError(failure.fieldPath, { type: "server", message: failure.message });
        form.setFocus(failure.fieldPath);
      } else form.setError("root.server", { type: "server", message: failure.message });
      return;
    }
    onSuccess(values.email);
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <>
      <PageHeader title="Create your account" />
      <FieldDescription>Step 2 of 2: your sign-in details.</FieldDescription>
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          name="email"
          label="Email"
          description="We send a verification link to this address."
          render={({ field, controlProps }) => (
            <Input
              type="email"
              autoComplete="email"
              placeholder="anne@example.com"
              {...field}
              {...controlProps}
            />
          )}
        />
        <FormField
          name="password"
          label="Password"
          description="Use at least 12 characters."
          render={({ field, controlProps }) => (
            <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
          )}
        />
        <FormField
          name="confirmPassword"
          label="Retype password"
          render={({ field, controlProps }) => (
            <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
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
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Submitting" : "Submit"}
          </Button>
        </div>
      </Form>
    </>
  );
}
