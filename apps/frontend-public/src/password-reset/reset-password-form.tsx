"use client";

import { usePasswordResetResetPassword } from "@heat/api-client";
import { passwordMinLength, resetPasswordFormSchema } from "@heat/contracts";
import type { ResetPasswordFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  PageHeader,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { classifyResetFailure } from "./reset-failure";

export interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const reset = usePasswordResetResetPassword();
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await reset.mutateAsync({ data: { token, password: values.password } });
      router.replace("/sign-in");
    } catch (error) {
      const failure = classifyResetFailure(error);
      if (failure.kind === "breached") {
        form.setError("password", { type: "server", message: failure.message });
        form.setFocus("password");
      } else if (failure.kind === "retry") {
        form.setError("root.server", { type: "server", message: failure.message });
      }
    }
  }

  if (reset.isError && classifyResetFailure(reset.error).kind === "link") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="This link cannot be used" />
        <FieldDescription>
          The reset link is not valid, has expired, or was already used. Request a new one.
        </FieldDescription>
        <div>
          <Button nativeButton={false} render={<Link href="/forgot-password" />}>
            Request a new link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      <FormField
        name="password"
        label="New password"
        description={`Use at least ${passwordMinLength} characters.`}
        render={({ field, controlProps }) => (
          <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="confirmPassword"
        label="Retype new password"
        render={({ field, controlProps }) => (
          <Input type="password" autoComplete="new-password" {...field} {...controlProps} />
        )}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        <KeyRoundIcon data-icon="inline-start" />
        {form.formState.isSubmitting ? "Saving" : "Set new password"}
      </Button>
    </Form>
  );
}
