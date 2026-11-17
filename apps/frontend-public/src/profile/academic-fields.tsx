"use client";

import {
  useDirectoryLookupsListDepartments,
  useDirectoryLookupsListFaculties,
  useDirectoryLookupsListUniversities,
} from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import type { UpdateProfileRequestInput } from "@heat/contracts";
import { FormField, Input } from "@heat/ui";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { chooseFaculty, chooseUniversity, dropStaleSelections } from "../enroll/cascade";
import { LookupSelect, LookupState, noOptions } from "../enroll/lookup-fields";

interface AcademicFieldsProps {
  current: Pick<ProfileResponseDto, "university" | "faculty" | "department">;
  locked: boolean;
  onBlockedChange: (blocked: boolean) => void;
}

export function AcademicFields({ current, locked, onBlockedChange }: AcademicFieldsProps) {
  const form = useFormContext<UpdateProfileRequestInput>();
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

  const universityOptions = locked ? [current.university] : (universities.data?.items ?? noOptions);
  const facultyOptions = locked ? [current.faculty] : (faculties.data?.items ?? noOptions);
  const departmentOptions = locked ? [current.department] : (departments.data?.items ?? noOptions);

  useEffect(() => {
    if (locked) return;
    const selected = form.getValues();
    const cleaned = dropStaleSelections(selected, {
      universities: universities.data?.items,
      faculties: selected.universityId ? faculties.data?.items : undefined,
      departments: selected.facultyId ? departments.data?.items : undefined,
    });
    if (cleaned === selected) return;
    form.setValue("universityId", cleaned.universityId);
    form.setValue("facultyId", cleaned.facultyId);
    form.setValue("departmentId", cleaned.departmentId);
  }, [form, locked, universities.data, faculties.data, departments.data]);

  const universityFailed = !locked && universities.isError;
  const facultyFailed = !locked && universityId !== "" && faculties.isError;
  const departmentFailed = !locked && facultyId !== "" && departments.isError;
  const blocked = universityFailed || facultyFailed || departmentFailed;

  useEffect(() => {
    onBlockedChange(blocked);
  }, [blocked, onBlockedChange]);

  function pick(next: UpdateProfileRequestInput) {
    const options = { shouldValidate: form.formState.isSubmitted };
    form.setValue("universityId", next.universityId, options);
    form.setValue("facultyId", next.facultyId, options);
    form.setValue("departmentId", next.departmentId, options);
  }

  return (
    <>
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
    </>
  );
}
