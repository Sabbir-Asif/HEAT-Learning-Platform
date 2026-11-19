"use client";

import { isApiError, useAdminAuthSignIn } from "@heat/api-client";
import { signInRequestSchema } from "@heat/contracts";
import type { SignInRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { accountPath } from "./sign-in-location";

export const invalidCredentialsMessage = "The email or password is not correct.";

export interface SignInFormProps {
  next: string;
}

export function destinationAfterSignIn(mustChangePassword: boolean, next: string): string {
  return mustChangePassword ? accountPath : next;
}

export function SignInForm({ next }: SignInFormProps) {
  const router = useRouter();
  const signIn = useAdminAuthSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInRequest) {
    try {
      const me = await signIn.mutateAsync({ data: values });
      router.replace(destinationAfterSignIn(me.user.mustChangePassword, next));
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
        label="Email"
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
          <InputGroup className="h-11">
            <InputGroupAddon>
              <LockIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              {...field}
              {...controlProps}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      />
      <Button type="submit" size="lg" className="h-11" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in" : "Sign in"}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </Form>
  );
}
