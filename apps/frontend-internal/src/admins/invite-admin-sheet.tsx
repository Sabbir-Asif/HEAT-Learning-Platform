"use client";

import { getAdminUsersListQueryKey, isApiError, useAdminUsersInvite } from "@heat/api-client";
import { inviteAdminRequestSchema } from "@heat/contracts";
import type { InviteAdminRequest } from "@heat/contracts";
import {
  Button,
  Form,
  FormField,
  FormMessage,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { MailPlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { emailInUseMessage } from "./admin-copy";

export function InviteAdminSheet({ onInvited }: { onInvited: (email: string) => void }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const invite = useAdminUsersInvite();
  const form = useForm<InviteAdminRequest>({
    resolver: zodResolver(inviteAdminRequestSchema),
    defaultValues: { email: "" },
  });

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) form.reset();
  }

  async function onSubmit(values: InviteAdminRequest) {
    try {
      const created = await invite.mutateAsync({ data: values });
      await queryClient.invalidateQueries({ queryKey: getAdminUsersListQueryKey().slice(0, 1) });
      onInvited(created.email);
      changeOpen(false);
    } catch (error) {
      if (isApiError(error) && error.code === "EMAIL_IN_USE") {
        form.setError("email", { type: "server", message: emailInUseMessage });
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
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger render={<Button />}>
        <MailPlusIcon data-icon="inline-start" />
        Invite admin
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Invite an admin</SheetTitle>
          <SheetDescription>
            They receive an email with a link to set their password. The link works once.
          </SheetDescription>
        </SheetHeader>
        <Form form={form} onSubmit={onSubmit} className="px-4">
          <FormMessage />
          <FormField
            name="email"
            label="Email"
            render={({ field, controlProps }) => (
              <Input
                type="email"
                autoComplete="off"
                inputMode="email"
                placeholder="name@du.ac.bd"
                {...field}
                {...controlProps}
              />
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Sending" : "Send invitation"}
          </Button>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
