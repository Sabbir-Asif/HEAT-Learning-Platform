"use client";

import {
  fetchResponse,
  isApiError,
  useCoursesList,
  useResourcesCreate,
  useResourcesUpdate,
} from "@heat/api-client";
import type { ResourceAdminDto } from "@heat/api-client";
import {
  formatFileSize,
  mediaAssetResponseSchema,
  resourceFormSchema,
  resourceRequestFromForm,
  resourceTypeLabel,
} from "@heat/contracts";
import type { ResourceFormValues } from "@heat/contracts";
import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  Form,
  FormField,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  applyServerError,
  formErrorCopy,
} from "@heat/ui";
import { FileUpload } from "@heat/ui/upload";
import type { UploadItemState } from "@heat/ui/upload";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  resourceSaveFailedMessage,
  resourceUploadFailedMessage,
  resourceUploadHelp,
} from "./resources-copy";
import { noCourseValue, resourceKindItems } from "./resources-status";

type ResourceFormProps = {
  resource: ResourceAdminDto | null;
  onSaved: (resource: ResourceAdminDto) => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

type UploadedFileInfo = { name: string; sizeBytes: number };

const valuesOf = (resource: ResourceAdminDto | null): ResourceFormValues => ({
  kind: resource?.kind ?? "file",
  title: resource?.title ?? "",
  description: resource?.description ?? "",
  url: resource?.url ?? "",
  mediaAssetId: resource?.file?.assetId ?? "",
  courseId: resource?.courseId ?? "",
  displayOrder: String(resource?.displayOrder ?? 0),
  published: resource?.published ?? false,
});

const codeFromBody = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return typeof body.code === "string" ? body.code : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export function ResourceForm({ resource, onSaved, onDirtyChange }: ResourceFormProps) {
  const create = useResourcesCreate();
  const update = useResourcesUpdate();
  const courses = useCoursesList({ pageSize: 50 });
  const publishedId = useId();
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: valuesOf(resource),
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const published = useWatch({ control: form.control, name: "published" });
  const mediaAssetId = useWatch({ control: form.control, name: "mediaAssetId" });
  const [problem, setProblem] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, UploadItemState>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [uploaded, setUploaded] = useState<UploadedFileInfo | null>(null);
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const courseItems = useMemo(
    () => [
      { value: noCourseValue, label: "No course" },
      ...(courses.data?.items ?? []).map((course) => ({ value: course.id, label: course.title })),
    ],
    [courses.data],
  );

  const currentFile =
    uploaded ??
    (resource?.file != null && resource.file.assetId === mediaAssetId
      ? {
          name: resourceTypeLabel("file", resource.file.mimeType),
          sizeBytes: resource.file.sizeBytes,
        }
      : null);

  async function send(id: string, file: File) {
    setStatuses((current) => ({ ...current, [id]: { status: "uploading", progress: 0 } }));
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "document");
      body.append("visibility", "public");
      const response = await fetchResponse("/admin/media", { method: "POST", body });
      if (!response.ok) {
        const code = await codeFromBody(response);
        setStatuses((current) => ({
          ...current,
          [id]: { status: "failed", message: resourceUploadFailedMessage(code) },
        }));
        return;
      }
      const asset = mediaAssetResponseSchema.parse(await response.json());
      form.setValue("mediaAssetId", asset.id, { shouldDirty: true, shouldValidate: true });
      setUploaded({ name: file.name, sizeBytes: asset.sizeBytes });
      setStatuses((current) => ({ ...current, [id]: { status: "done" } }));
    } catch (error) {
      const code = isApiError(error) ? error.code : undefined;
      setStatuses((current) => ({
        ...current,
        [id]: { status: "failed", message: resourceUploadFailedMessage(code) },
      }));
    }
  }

  async function onSubmit(values: ResourceFormValues) {
    setProblem(null);
    const data = resourceRequestFromForm(values);
    try {
      const saved =
        resource === null
          ? await create.mutateAsync({ data })
          : await update.mutateAsync({ id: resource.id, data });
      form.reset(valuesOf(saved));
      await onSaved(saved);
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.fields?.length) {
        applyServerError(form, { error: { code: error.code, fields: error.fields } });
      }
      setProblem(
        isApiError(error) ? resourceSaveFailedMessage(error.code) : formErrorCopy.INTERNAL,
      );
    }
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormMessage />
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <FormField
        name="kind"
        label="Type"
        render={({ field, controlProps }) => (
          <Select
            items={resourceKindItems}
            value={field.value}
            onValueChange={(value) => field.onChange(value ?? "file")}
          >
            <SelectTrigger {...controlProps} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resourceKindItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FormField
        name="title"
        label="Title"
        render={({ field, controlProps }) => (
          <Input autoComplete="off" {...field} {...controlProps} />
        )}
      />
      <FormField
        name="description"
        label="Description"
        description="Optional. Shown under the title on the public page."
        render={({ field, controlProps }) => (
          <Textarea autoComplete="off" {...field} {...controlProps} />
        )}
      />
      {kind === "link" ? (
        <FormField
          name="url"
          label="Web address"
          description="Must start with https://."
          render={({ field, controlProps }) => (
            <Input type="url" autoComplete="off" {...field} {...controlProps} />
          )}
        />
      ) : (
        <FormField
          name="mediaAssetId"
          label="File"
          description={resourceUploadHelp}
          render={({ controlProps }) => (
            <div className="flex flex-col gap-2">
              {currentFile === null ? null : (
                <FieldDescription role="status">
                  {`Current file: ${currentFile.name} (${formatFileSize(currentFile.sizeBytes)})`}
                </FieldDescription>
              )}
              <FileUpload
                label={currentFile === null ? "Upload file" : "Replace file"}
                preset="documents"
                statuses={statuses}
                disabled={form.formState.isSubmitting}
                onFilesAccepted={(accepted) => {
                  for (const item of accepted) {
                    setFiles((current) => ({ ...current, [item.id]: item.file }));
                    void send(item.id, item.file);
                  }
                }}
                onCancel={() => undefined}
                onRetry={(id) => {
                  const file = files[id];
                  if (file !== undefined) void send(id, file);
                }}
              />
              <input type="hidden" id={controlProps.id} readOnly value={mediaAssetId} />
            </div>
          )}
        />
      )}
      <FormField
        name="courseId"
        label="Related course"
        description="Optional."
        render={({ field, controlProps }) => (
          <Select
            items={courseItems}
            value={field.value === "" ? noCourseValue : field.value}
            onValueChange={(value) =>
              field.onChange(value === null || value === noCourseValue ? "" : value)
            }
          >
            <SelectTrigger {...controlProps} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courseItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FormField
        name="displayOrder"
        label="Display order"
        description="Lower numbers appear first on the public page."
        render={({ field, controlProps }) => (
          <Input type="number" min={0} inputMode="numeric" {...field} {...controlProps} />
        )}
      />
      <Field orientation="horizontal">
        <Checkbox
          id={publishedId}
          checked={published}
          onCheckedChange={(next) =>
            form.setValue("published", next === true, { shouldDirty: true })
          }
        />
        <FieldLabel htmlFor={publishedId}>Published on the public Resources page</FieldLabel>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </Form>
  );
}
