"use client";

import { isApiError, useAdminAuthSignIn } from "@heat/api-client";
import { signInRequestSchema } from "@heat/contracts";
import type { SignInRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogInIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="name@du.ac.bd"
            {...field}
            {...controlProps}
          />
        )}
      />
      <FormField
        name="password"
        label="Password"
        render={({ field, controlProps }) => (
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...field}
            {...controlProps}
          />
        )}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        <LogInIcon data-icon="inline-start" />
        {form.formState.isSubmitting ? "Signing in" : "Sign in"}
      </Button>
      <Button
        variant="link"
        size="sm"
        nativeButton={false}
        render={<Link href="/forgot-password" />}
      >
        Forgot password?
      </Button>
    </Form>
  );
}
