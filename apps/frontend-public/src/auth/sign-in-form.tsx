"use client";

import { isApiError, useStudentAuthSignIn } from "@heat/api-client";
import { landingPathFor, signInRequestSchema } from "@heat/contracts";
import type { SignInRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { defaultNextPath } from "./next-path";
import { PasswordInput } from "./password-input";

export const invalidCredentialsMessage = "The email or password is not correct.";

export interface SignInFormProps {
  next: string;
}

export function destinationAfterSignIn(
  enrollments: Parameters<typeof landingPathFor>[0],
  next: string,
): string {
  const landing = landingPathFor(enrollments);
  return landing === defaultNextPath ? next : landing;
}

export function SignInForm({ next }: SignInFormProps) {
  const router = useRouter();
  const signIn = useStudentAuthSignIn();
  const form = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInRequest) {
    try {
      const me = await signIn.mutateAsync({ data: values });
      router.replace(destinationAfterSignIn(me.enrollments, next));
    } catch (error) {
      if (isApiError(error) && error.code === "INVALID_CREDENTIALS") {
        form.setError("root.server", { type: "server", message: invalidCredentialsMessage });
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
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      <FormField
        name="email"
        label="University email"
        render={({ field, controlProps }) => (
          <InputGroup className="h-11">
            <InputGroupAddon>
              <MailIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="name@du.ac.bd"
              {...field}
              {...controlProps}
            />
          </InputGroup>
        )}
      />
      <FormField
        name="password"
        label="Password"
        labelAction={
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            nativeButton={false}
            render={<Link href="/forgot-password" />}
          >
            Forgot password?
          </Button>
        }
        render={({ field, controlProps }) => (
          <PasswordInput
            autoComplete="current-password"
            placeholder="Your password"
            {...field}
            {...controlProps}
          />
        )}
      />
      <Button type="submit" size="lg" className="h-11" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in" : "Sign in"}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
      <p className="text-muted-foreground border-divider border-t pt-5 text-center text-sm">
        New to the program?{" "}
        <Link
          href="/enroll"
          className="text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 outline-hidden hover:underline focus-visible:ring-2"
        >
          Create an account
        </Link>
      </p>
    </Form>
  );
}
