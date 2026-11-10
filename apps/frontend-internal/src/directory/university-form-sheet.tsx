"use client";

import { isApiError, useUniversitiesCreate, useUniversitiesUpdate } from "@heat/api-client";
import type { UniversitySummaryDto } from "@heat/api-client";
import { createUniversityRequestSchema } from "@heat/contracts";
import type { CreateUniversityRequest } from "@heat/contracts";
import {
  Button,
  FieldDescription,
  Form,
  FormField,
  FormMessage,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  applyServerError,
  formErrorCopy,
  rateLimitedMessage,
} from "@heat/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { universityNameTakenMessage, unsavedChangesMessage } from "./directory-copy";

export type UniversityFormTarget = UniversitySummaryDto | "create" | null;

type UniversityFormSheetProps = {
  target: UniversityFormTarget;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function UniversityFormSheet({ target, onClose, onSaved }: UniversityFormSheetProps) {
  const create = useUniversitiesCreate();
  const update = useUniversitiesUpdate();
  const [discarding, setDiscarding] = useState(false);
  const form = useForm<CreateUniversityRequest>({
    resolver: zodResolver(createUniversityRequestSchema),
    defaultValues: { name: "" },
  });
  const editing = target !== null && target !== "create" ? target : null;

  const { reset } = form;
  const { isDirty } = form.formState;
  useEffect(() => {
    reset({ name: editing?.name ?? "" });
  }, [reset, editing]);

  function close() {
    setDiscarding(false);
    onClose();
  }

  function requestClose() {
    if (isDirty && !discarding) {
      setDiscarding(true);
      return;
    }
    close();
  }

  async function onSubmit(values: CreateUniversityRequest) {
    try {
      const saved =
        editing === null
          ? await create.mutateAsync({ data: values })
          : await update.mutateAsync({ id: editing.id, data: values });
      onSaved(editing === null ? `${saved.name} was added.` : `${saved.name} was saved.`);
      close();
    } catch (error) {
      if (isApiError(error) && error.code === "DIRECTORY_NAME_TAKEN") {
        form.setError("name", { type: "server", message: universityNameTakenMessage });
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
    <Sheet open={target !== null} onOpenChange={(next) => (next ? undefined : requestClose())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{editing === null ? "Add a university" : "Edit university"}</SheetTitle>
          <SheetDescription>
            Students choose their university, faculty and department from this directory.
          </SheetDescription>
        </SheetHeader>
        <Form form={form} onSubmit={onSubmit} className="px-4">
          <FormMessage />
          <FormField
            name="name"
            label="Name"
            render={({ field, controlProps }) => (
              <Input autoComplete="off" {...field} {...controlProps} />
            )}
          />
          {discarding ? (
            <div role="alert" className="flex flex-col gap-2">
              <FieldDescription>{unsavedChangesMessage}</FieldDescription>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" onClick={close}>
                  Discard changes
                </Button>
                <Button type="button" variant="outline" onClick={() => setDiscarding(false)}>
                  Keep editing
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
            </div>
          )}
        </Form>
      </SheetContent>
    </Sheet>
  );
}
