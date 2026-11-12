"use client";

import { isApiError, useAdminSiteSettingsUpdate } from "@heat/api-client";
import type { AdminLandingOverviewResponseDto } from "@heat/api-client";
import {
  landingOverviewFormSchema,
  parseRichText,
  richTextEmptyDoc,
  richTextSchemaVersion,
} from "@heat/contracts";
import type { LandingOverviewFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  Skeleton,
  applyServerError,
  formErrorCopy,
} from "@heat/ui";
import type { RichTextDocument } from "@heat/ui/content";
import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { landingOverviewFailedMessage } from "./landing-overview-copy";

const RichTextEditor = dynamic(
  () => import("@heat/ui/editor").then((module) => module.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

type LandingOverviewFormProps = {
  overview: AdminLandingOverviewResponseDto;
  onSaved: () => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

export function LandingOverviewForm({
  overview,
  onSaved,
  onDirtyChange,
}: LandingOverviewFormProps) {
  const save = useAdminSiteSettingsUpdate();
  const form = useForm<LandingOverviewFormValues>({
    resolver: zodResolver(landingOverviewFormSchema),
    defaultValues: { heading: overview.heading },
  });
  const [draft, setDraft] = useState<RichTextDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { isDirty } = form.formState;
  const parsed = parseRichText(overview.body);
  const stored: RichTextDocument = parsed.ok ? parsed.doc : richTextEmptyDoc;

  useEffect(() => {
    onDirtyChange(isDirty || draft !== null);
  }, [isDirty, draft, onDirtyChange]);

  async function onSubmit(values: LandingOverviewFormValues) {
    setProblem(null);
    try {
      await save.mutateAsync({
        data: {
          heading: values.heading,
          schemaVersion: richTextSchemaVersion,
          body: draft ?? stored,
          imageAssetId: overview.imageAssetId,
        },
      });
      form.reset({ heading: values.heading });
      setDraft(null);
      await onSaved();
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.fields?.length) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
        setProblem(landingOverviewFailedMessage(error.code));
        return;
      }
      setProblem(
        isApiError(error) ? landingOverviewFailedMessage(error.code) : formErrorCopy.INTERNAL,
      );
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <FormField
        name="heading"
        label="Heading"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <RichTextEditor
        label="Overview text"
        value={stored}
        images={overview.images}
        onChange={setDraft}
        disabled={save.isPending}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </Form>
  );
}
