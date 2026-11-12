"use client";

import {
  getProfileDescribeQueryKey,
  useDirectoryLookupsListDepartments,
  useDirectoryLookupsListFaculties,
  useDirectoryLookupsListUniversities,
  useProfileUpdate,
} from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import { updateProfileRequestSchema } from "@heat/contracts";
import type { UpdateProfileRequestInput } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  applyServerError,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { chooseFaculty, chooseUniversity, dropStaleSelections } from "../enroll/cascade";
import { LookupSelect, LookupState, noOptions } from "../enroll/lookup-fields";
import { classifySubmitError } from "../enroll/submit-error";
import { lockedExplanation, requestChangeLabel } from "./profile-copy";
import { supportEmail } from "../enroll/support-contact";

interface DetailsFormProps {
  profile: ProfileResponseDto;
}

export function DetailsForm({ profile }: DetailsFormProps) {
  const locked = profile.locked;
  const queryClient = useQueryClient();
  const update = useProfileUpdate();
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
  const values = useWatch({ control: form.control });
  const universityId = values.universityId ?? "";
  const facultyId = values.facultyId ?? "";

  const universities = useDirectoryLookupsListUniversities({ query: { enabled: !locked } });
  const faculties = useDirectoryLookupsListFaculties(universityId, {
    query: { enabled: !locked && universityId !== "" },
  });
  const departments = useDirectoryLookupsListDepartments(universityId, facultyId, {
    query: { enabled: !locked && universityId !== "" && facultyId !== "" },
  });

  const universityOptions = locked ? [profile.university] : (universities.data?.items ?? noOptions);
  const facultyOptions = locked ? [profile.faculty] : (faculties.data?.items ?? noOptions);
  const departmentOptions = locked ? [profile.department] : (departments.data?.items ?? noOptions);

  useEffect(() => {
    if (locked) return;
    const current = form.getValues();
    const cleaned = dropStaleSelections(current, {
      universities: universities.data?.items,
      faculties: current.universityId ? faculties.data?.items : undefined,
      departments: current.facultyId ? departments.data?.items : undefined,
    });
    if (cleaned === current) return;
    form.setValue("universityId", cleaned.universityId);
    form.setValue("facultyId", cleaned.facultyId);
    form.setValue("departmentId", cleaned.departmentId);
  }, [form, locked, universities.data, faculties.data, departments.data]);

  const universityFailed = !locked && universities.isError;
  const facultyFailed = !locked && universityId !== "" && faculties.isError;
  const departmentFailed = !locked && facultyId !== "" && departments.isError;
  const blocked = universityFailed || facultyFailed || departmentFailed;

  function pick(next: UpdateProfileRequestInput) {
    const options = { shouldValidate: form.formState.isSubmitted };
    form.setValue("universityId", next.universityId, options);
    form.setValue("facultyId", next.facultyId, options);
    form.setValue("departmentId", next.departmentId, options);
  }

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
      <FormField
        name="name"
        label="Full name in English"
        description="This is printed on your certificate."
        render={({ field, controlProps }) => (
          <Input autoComplete="name" readOnly={locked} {...field} {...controlProps} />
        )}
      />
      <FormField
        name="universityId"
        label="University"
        render={({ field, controlProps }) => (
          <>
            <LookupSelect
              label="University"
              placeholder="Select your university"
              options={universityOptions}
              disabled={locked || universities.isPending || universityFailed}
              value={field.value}
              triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
              onChange={(id) => pick(chooseUniversity(form.getValues(), id))}
            />
            <LookupState
              failed={universityFailed}
              empty={false}
              emptyTitle=""
              onRetry={() => void universities.refetch()}
            />
          </>
        )}
      />
      <FormField
        name="facultyId"
        label="Faculty"
        render={({ field, controlProps }) => (
          <>
            <LookupSelect
              label="Faculty"
              placeholder="Select your faculty"
              options={facultyOptions}
              disabled={locked || !universityId || faculties.isPending || facultyFailed}
              value={field.value}
              triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
              onChange={(id) => pick(chooseFaculty(form.getValues(), id))}
            />
            <LookupState
              failed={facultyFailed}
              empty={false}
              emptyTitle=""
              onRetry={() => void faculties.refetch()}
            />
          </>
        )}
      />
      <FormField
        name="departmentId"
        label="Department"
        render={({ field, controlProps }) => (
          <>
            <LookupSelect
              label="Department"
              placeholder="Select your department"
              options={departmentOptions}
              disabled={locked || !facultyId || departments.isPending || departmentFailed}
              value={field.value}
              triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
              onChange={(id) =>
                form.setValue("departmentId", id, { shouldValidate: form.formState.isSubmitted })
              }
            />
            <LookupState
              failed={departmentFailed}
              empty={false}
              emptyTitle=""
              onRetry={() => void departments.refetch()}
            />
          </>
        )}
      />
      <FormField
        name="session"
        label="Session"
        description="For example 2020-21."
        render={({ field, controlProps }) => (
          <Input inputMode="numeric" readOnly={locked} {...field} {...controlProps} />
        )}
      />
      <FormMessage />
      {locked ? (
        <>
          <FieldDescription>{lockedExplanation}</FieldDescription>
          <div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`mailto:${supportEmail}?subject=Profile%20change%20request`} />}
            >
              {requestChangeLabel}
            </Button>
          </div>
        </>
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
