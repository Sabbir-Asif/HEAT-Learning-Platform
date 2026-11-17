"use client";

import { fetchResponse, isApiError, useNewsCreate, useNewsUpdate } from "@heat/api-client";
import type { NewsAdminPostDto, NewsPostRequestDto } from "@heat/api-client";
import {
  dhakaLocalToIso,
  isoToDhakaLocal,
  mediaAssetResponseSchema,
  newsPostFormSchema,
  parseRichText,
  richTextEmptyDoc,
  richTextSchemaVersion,
} from "@heat/contracts";
import type { NewsPostFormValues } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  applyServerError,
  formErrorCopy,
} from "@heat/ui";
import type { RichTextDocument, RichTextImage } from "@heat/ui/content";
import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { newsInvalidDateMessage, newsPublishDateHelp, newsSaveFailedMessage } from "./news-copy";
import { newsEditorStatusItems } from "./news-status";

const RichTextEditor = dynamic(
  () => import("@heat/ui/editor").then((module) => module.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

type NewsFormProps = {
  post: NewsAdminPostDto | null;
  onSaved: (post: NewsAdminPostDto) => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

const valuesOf = (post: NewsAdminPostDto | null): NewsPostFormValues => ({
  title: post?.title ?? "",
  status: post === null || post.status === "draft" ? "draft" : "published",
  publishAt: isoToDhakaLocal(post?.publishedAt ?? null),
});

async function uploadImage(file: File, alt: string): Promise<RichTextImage> {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", "image");
  body.append("visibility", "public");
  body.append("altText", alt);
  const response = await fetchResponse("/admin/media", { method: "POST", body });
  if (!response.ok) throw new Error("Upload failed");
  const asset = mediaAssetResponseSchema.parse(await response.json());
  return { assetId: asset.id, url: asset.url, alt };
}

export function NewsForm({ post, onSaved, onDirtyChange }: NewsFormProps) {
  const create = useNewsCreate();
  const update = useNewsUpdate();
  const form = useForm<NewsPostFormValues>({
    resolver: zodResolver(newsPostFormSchema),
    defaultValues: valuesOf(post),
  });
  const [draft, setDraft] = useState<RichTextDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const status = useWatch({ control: form.control, name: "status" });
  const { isDirty } = form.formState;
  const parsed = parseRichText(post?.body);
  const stored: RichTextDocument = parsed.ok ? parsed.doc : richTextEmptyDoc;

  useEffect(() => {
    onDirtyChange(isDirty || draft !== null);
  }, [isDirty, draft, onDirtyChange]);

  async function onSubmit(values: NewsPostFormValues) {
    setProblem(null);
    const publishedAt =
      values.status === "published" && values.publishAt !== ""
        ? dhakaLocalToIso(values.publishAt)
        : null;
    if (values.status === "published" && values.publishAt !== "" && publishedAt === null) {
      form.setError("publishAt", { type: "validate", message: newsInvalidDateMessage });
      return;
    }
    const data: NewsPostRequestDto = {
      title: values.title,
      schemaVersion: richTextSchemaVersion,
      body: draft ?? stored,
      status: values.status,
      publishedAt,
    };
    try {
      const saved =
        post === null
          ? await create.mutateAsync({ data })
          : await update.mutateAsync({ id: post.id, data });
      form.reset(valuesOf(saved));
      setDraft(null);
      await onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.fields?.length) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
      }
      setProblem(isApiError(error) ? newsSaveFailedMessage(error.code) : formErrorCopy.INTERNAL);
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <FormField
        name="title"
        label="Title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <RichTextEditor
        label="Post text"
        value={stored}
        images={post?.images ?? []}
        onChange={setDraft}
        onUploadImage={uploadImage}
        disabled={form.formState.isSubmitting}
      />
      <FormField
        name="status"
        label="Status"
        render={({ field, controlProps }) => (
          <Select
            items={newsEditorStatusItems}
            value={field.value}
            onValueChange={(value) => field.onChange(value ?? "draft")}
          >
            <SelectTrigger {...controlProps} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {newsEditorStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {status === "published" ? (
        <FormField
          name="publishAt"
          label="Publish date and time"
          description={newsPublishDateHelp}
          render={({ field, controlProps }) => (
            <Input type="datetime-local" {...field} {...controlProps} />
          )}
        />
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </Form>
  );
}
