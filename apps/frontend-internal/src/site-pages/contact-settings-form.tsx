"use client";

import { isApiError, useAdminContactSettingsUpdate } from "@heat/api-client";
import type { AdminContactSettingsResponseDto } from "@heat/api-client";
import { contactSettingsFormSchema } from "@heat/contracts";
import type { ContactSettingsFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  Textarea,
  applyServerError,
  formErrorCopy,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { contactSettingsFailedMessage } from "./contact-settings-copy";

type ContactSettingsFormProps = {
  settings: AdminContactSettingsResponseDto;
  onSaved: () => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

export function ContactSettingsForm({
  settings,
  onSaved,
  onDirtyChange,
}: ContactSettingsFormProps) {
  const save = useAdminContactSettingsUpdate();
  const form = useForm<ContactSettingsFormValues>({
    resolver: zodResolver(contactSettingsFormSchema),
    defaultValues: {
      organisation: settings.organisation,
      address: settings.address,
      email: settings.email,
      phone: settings.phone,
      officeHours: settings.officeHours,
    },
  });
  const [problem, setProblem] = useState<string | null>(null);
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: ContactSettingsFormValues) {
    setProblem(null);
    try {
      await save.mutateAsync({ data: values });
      form.reset(values);
      await onSaved();
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.fields?.length) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
        setProblem(contactSettingsFailedMessage(error.code));
        return;
      }
      setProblem(
        isApiError(error) ? contactSettingsFailedMessage(error.code) : formErrorCopy.INTERNAL,
      );
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <FormField
        name="organisation"
        label="Organisation name"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="address"
        label="Address"
        render={({ field, controlProps }) => (
          <Textarea autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="email"
        label="Email"
        render={({ field, controlProps }) => (
          <Input type="email" autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="phone"
        label="Phone"
        render={({ field, controlProps }) => (
          <Input type="tel" autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="officeHours"
        label="Office hours"
        render={({ field, controlProps }) => (
          <Textarea autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </Form>
  );
}
