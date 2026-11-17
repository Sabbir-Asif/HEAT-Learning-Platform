"use client";

import {
  getProfileChangeLatestQueryKey,
  getProfileDescribeQueryKey,
  useProfileChangeSubmit,
} from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import { profileChangeNoteMaxLength, submitProfileChangeRequestSchema } from "@heat/contracts";
import type { SubmitProfileChangeRequestInput } from "@heat/contracts";
import { Button, Form, FormField, FormMessage, Textarea, applyServerError } from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { classifySubmitError } from "../enroll/submit-error";
import { AcademicFields } from "./academic-fields";
import { changeRequestSubmitLabel } from "./profile-copy";

interface ChangeRequestFormProps {
  profile: ProfileResponseDto;
}

const refreshCodes = ["PROFILE_CHANGE_PENDING", "PROFILE_CHANGE_NOT_PENDING"];

const isRefreshError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string" &&
  refreshCodes.includes(error.code);

export function ChangeRequestForm({ profile }: ChangeRequestFormProps) {
  const queryClient = useQueryClient();
  const submit = useProfileChangeSubmit();
  const [blocked, setBlocked] = useState(false);
  const form = useForm<SubmitProfileChangeRequestInput>({
    resolver: zodResolver(submitProfileChangeRequestSchema),
    defaultValues: {
      name: profile.name,
      universityId: profile.university.id,
      facultyId: profile.faculty.id,
      departmentId: profile.department.id,
      session: profile.session,
      note: "",
    },
  });

  async function onSubmit(parsed: SubmitProfileChangeRequestInput) {
    if (blocked) return;
    try {
      await submit.mutateAsync({ data: parsed });
      await queryClient.invalidateQueries({ queryKey: getProfileChangeLatestQueryKey() });
    } catch (error) {
      const failure = classifySubmitError(error);
      if (failure.payload) applyServerError(form, failure.payload);
      else form.setError("root.server", { type: "server", message: failure.message });
      if (isRefreshError(error)) {
        await queryClient.invalidateQueries({ queryKey: getProfileChangeLatestQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getProfileDescribeQueryKey() });
      }
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit} aria-label="Change request">
      <AcademicFields current={profile} locked={false} onBlockedChange={setBlocked} />
      <FormField
        name="note"
        label="Note for the admin"
        description="Optional. Say why the details need to change."
        render={({ field, controlProps }) => (
          <Textarea
            maxLength={profileChangeNoteMaxLength}
            {...field}
            value={field.value ?? ""}
            {...controlProps}
          />
        )}
      />
      <FormMessage />
      <div>
        <Button type="submit" disabled={blocked || isSubmitting}>
          {isSubmitting ? "Sending" : changeRequestSubmitLabel}
        </Button>
      </div>
    </Form>
  );
}
