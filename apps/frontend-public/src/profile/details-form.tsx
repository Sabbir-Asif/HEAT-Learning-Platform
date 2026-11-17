"use client";

import { getProfileDescribeQueryKey, useProfileUpdate } from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import { updateProfileRequestSchema } from "@heat/contracts";
import type { UpdateProfileRequestInput } from "@heat/contracts";
import { Button, FieldDescription, Form, FormMessage, applyServerError } from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { classifySubmitError } from "../enroll/submit-error";
import { AcademicFields } from "./academic-fields";
import { lockedExplanation } from "./profile-copy";

interface DetailsFormProps {
  profile: ProfileResponseDto;
}

export function DetailsForm({ profile }: DetailsFormProps) {
  const locked = profile.locked;
  const queryClient = useQueryClient();
  const update = useProfileUpdate();
  const [blocked, setBlocked] = useState(false);
  const form = useForm<UpdateProfileRequestInput>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: {
      name: profile.name,
      universityId: profile.university.id,
      facultyId: profile.faculty.id,
      departmentId: profile.department.id,
      session: profile.session,
    },
  });

  async function onSubmit(parsed: UpdateProfileRequestInput) {
    if (blocked) return;
    try {
      const saved = await update.mutateAsync({ data: parsed });
      queryClient.setQueryData(getProfileDescribeQueryKey(), saved);
    } catch (error) {
      const failure = classifySubmitError(error);
      if (failure.payload) applyServerError(form, failure.payload);
      else form.setError("root.server", { type: "server", message: failure.message });
      if (isLockedError(error))
        await queryClient.invalidateQueries({ queryKey: getProfileDescribeQueryKey() });
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit} aria-label="Name and academic details">
      <AcademicFields current={profile} locked={locked} onBlockedChange={setBlocked} />
      <FormMessage />
      {locked ? (
        <FieldDescription>{lockedExplanation}</FieldDescription>
      ) : (
        <div>
          <Button type="submit" disabled={blocked || isSubmitting}>
            {isSubmitting ? "Saving" : "Save changes"}
          </Button>
          {update.isSuccess && !isSubmitting ? (
            <FieldDescription role="status">Saved.</FieldDescription>
          ) : null}
        </div>
      )}
    </Form>
  );
}

const isLockedError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "PROFILE_LOCKED";
