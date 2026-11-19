"use client";

import { useEnrollmentSubmit } from "@heat/api-client";
import { enrollmentStepOneSchema, enrollmentStepTwoSchema } from "@heat/contracts";
import type { EnrollmentStepTwo, EnrollmentStepTwoInput } from "@heat/contracts";
import {
  Button,
  CaptchaField,
  Form,
  FormField,
  FormMessage,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  applyServerError,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, MailIcon } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { PasswordInput } from "../auth/password-input";
import { EnrollHeader } from "./enroll-header";
import { readStepOne } from "./step-one-store";
import { supportEmail } from "./support-contact";
import { classifySubmitError } from "./submit-error";
import { useCaptcha } from "./use-captcha";

export { supportEmail };

const emptyStepTwo: EnrollmentStepTwoInput = {
  email: "",
  password: "",
  confirmPassword: "",
  captchaId: "",
  captchaAnswer: "",
};

interface StepTwoProps {
  courseSlug: string;
  courseTitle?: string | undefined;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export function StepTwo({ courseSlug, courseTitle, onBack, onSuccess }: StepTwoProps) {
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
      <EnrollHeader
        step={2}
        title="Create your account"
        description="Step 2 of 2: your sign-in details."
        courseTitle={courseTitle}
      />
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          name="email"
          label="Email"
          description="We send a verification link to this address."
          render={({ field, controlProps }) => (
            <InputGroup className="h-11">
              <InputGroupAddon>
                <MailIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="email"
                autoComplete="email"
                placeholder="anne@example.com"
                {...field}
                {...controlProps}
              />
            </InputGroup>
          )}
        />
        <FormField
          name="password"
          label="Password"
          description="Use at least 12 characters."
          render={({ field, controlProps }) => (
            <PasswordInput autoComplete="new-password" {...field} {...controlProps} />
          )}
        />
        <FormField
          name="confirmPassword"
          label="Retype password"
          render={({ field, controlProps }) => (
            <PasswordInput autoComplete="new-password" {...field} {...controlProps} />
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
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11"
            onClick={onBack}
            disabled={isSubmitting}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          <Button type="submit" size="lg" className="h-11 sm:min-w-40" disabled={isSubmitting}>
            {isSubmitting ? "Submitting" : "Create account"}
          </Button>
        </div>
      </Form>
    </>
  );
}
