"use client";

import {
  useDirectoryLookupsListDepartments,
  useDirectoryLookupsListFaculties,
  useDirectoryLookupsListUniversities,
} from "@heat/api-client";
import { enrollmentStepOneSchema } from "@heat/contracts";
import { Button, FieldDescription, Form, FormField, Input, PageHeader } from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { chooseFaculty, chooseUniversity, dropStaleSelections } from "./cascade";
import { EnrollSuccess } from "./enroll-success";
import { LookupSelect, LookupState, noOptions } from "./lookup-fields";
import {
  clearStepOne,
  emptyStepOne,
  readStepOne,
  writeStepOne,
  type StepOneValues,
} from "./step-one-store";
import { StepTwo } from "./step-two";

interface EnrollWizardProps {
  courseSlug: string;
}

export function EnrollWizard({ courseSlug }: EnrollWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [enrolledEmail, setEnrolledEmail] = useState<string>();
  const hydrated = useRef(false);
  const form = useForm<StepOneValues>({
    resolver: zodResolver(enrollmentStepOneSchema),
    defaultValues: emptyStepOne,
  });
  const values = useWatch({ control: form.control });
  const universityId = values.universityId ?? "";
  const facultyId = values.facultyId ?? "";

  const universities = useDirectoryLookupsListUniversities();
  const faculties = useDirectoryLookupsListFaculties(universityId, {
    query: { enabled: universityId !== "" },
  });
  const departments = useDirectoryLookupsListDepartments(universityId, facultyId, {
    query: { enabled: universityId !== "" && facultyId !== "" },
  });

  const universityOptions = universities.data?.items ?? noOptions;
  const facultyOptions = universityId ? (faculties.data?.items ?? noOptions) : noOptions;
  const departmentOptions =
    universityId && facultyId ? (departments.data?.items ?? noOptions) : noOptions;

  useEffect(() => {
    form.reset(readStepOne());
    hydrated.current = true;
  }, [form]);

  useEffect(() => {
    if (hydrated.current) writeStepOne(form.getValues());
  }, [form, values]);

  useEffect(() => {
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
  }, [form, universities.data, faculties.data, departments.data]);

  const universityFailed = universities.isError;
  const facultyFailed = universityId !== "" && faculties.isError;
  const departmentFailed = facultyId !== "" && departments.isError;
  const universityEmpty = universities.isSuccess && universityOptions.length === 0;
  const facultyEmpty = universityId !== "" && faculties.isSuccess && facultyOptions.length === 0;
  const departmentEmpty =
    facultyId !== "" && departments.isSuccess && departmentOptions.length === 0;
  const blocked =
    universityFailed ||
    facultyFailed ||
    departmentFailed ||
    universityEmpty ||
    facultyEmpty ||
    departmentEmpty;

  function pick(next: StepOneValues) {
    const options = { shouldValidate: form.formState.isSubmitted };
    form.setValue("universityId", next.universityId, options);
    form.setValue("facultyId", next.facultyId, options);
    form.setValue("departmentId", next.departmentId, options);
  }

  function onSubmit(parsed: StepOneValues) {
    if (blocked) return;
    writeStepOne(parsed);
    setStep(2);
  }

  if (enrolledEmail !== undefined) return <EnrollSuccess email={enrolledEmail} />;

  if (step === 2) {
    return (
      <StepTwo
        courseSlug={courseSlug}
        onBack={() => setStep(1)}
        onSuccess={(email) => {
          clearStepOne();
          setEnrolledEmail(email);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title="Enroll" />
      <FieldDescription>Step 1 of 2: your academic details.</FieldDescription>
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          name="name"
          label="Full name in English"
          description="This is printed on your certificate."
          render={({ field, controlProps }) => (
            <Input autoComplete="name" placeholder="Anne Smith" {...field} {...controlProps} />
          )}
        />
        <FormField
          name="universityId"
          label="University"
          render={({ field, controlProps }) => (
            <>
              <LookupSelect
                label="University"
                placeholder={
                  universities.isPending ? "Loading universities" : "Select your university"
                }
                options={universityOptions}
                disabled={universities.isPending || universityFailed}
                value={field.value}
                triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
                onChange={(id) => pick(chooseUniversity(form.getValues(), id))}
              />
              <LookupState
                failed={universityFailed}
                empty={universityEmpty}
                emptyTitle="No universities are available"
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
                placeholder={
                  universityId && faculties.isPending ? "Loading faculties" : "Select your faculty"
                }
                options={facultyOptions}
                disabled={!universityId || faculties.isPending || facultyFailed}
                value={field.value}
                triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
                onChange={(id) => pick(chooseFaculty(form.getValues(), id))}
              />
              <LookupState
                failed={facultyFailed}
                empty={facultyEmpty}
                emptyTitle="This university has no faculties yet"
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
                placeholder={
                  facultyId && departments.isPending
                    ? "Loading departments"
                    : "Select your department"
                }
                options={departmentOptions}
                disabled={!facultyId || departments.isPending || departmentFailed}
                value={field.value}
                triggerProps={{ ...controlProps, ref: field.ref, onBlur: field.onBlur }}
                onChange={(id) =>
                  form.setValue("departmentId", id, { shouldValidate: form.formState.isSubmitted })
                }
              />
              <LookupState
                failed={departmentFailed}
                empty={departmentEmpty}
                emptyTitle="This faculty has no departments yet"
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
            <Input inputMode="numeric" placeholder="2020-21" {...field} {...controlProps} />
          )}
        />
        <Button type="submit" size="lg" disabled={blocked}>
          Next
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </Form>
    </>
  );
}
