"use client";

import {
  isApiError,
  useFacultiesAssign,
  useFacultiesCreate,
  useFacultiesUnassign,
  useFacultiesUpdate,
  useUniversitiesList,
} from "@heat/api-client";
import type { FacultySummaryDto } from "@heat/api-client";
import { facultyFormSchema } from "@heat/contracts";
import type { FacultyFormValues } from "@heat/contracts";
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
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  facultyNameTakenMessage,
  linkProblemMessage,
  unsavedChangesMessage,
} from "./directory-copy";

export type FacultyFormTarget = FacultySummaryDto | "create" | null;

type FacultyFormSheetProps = {
  target: FacultyFormTarget;
  onClose: () => void;
  onSaved: (message: string, problem: boolean) => void;
};

const universityOptionLimit = 50;

export function FacultyFormSheet({ target, onClose, onSaved }: FacultyFormSheetProps) {
  const create = useFacultiesCreate();
  const update = useFacultiesUpdate();
  const assign = useFacultiesAssign();
  const unassign = useFacultiesUnassign();
  const universities = useUniversitiesList(
    { page: 1, pageSize: universityOptionLimit, sort: "name" },
    { query: { enabled: target !== null } },
  );
  const [discarding, setDiscarding] = useState(false);
  const editing = target !== null && target !== "create" ? target : null;
  const form = useForm<FacultyFormValues>({
    resolver: zodResolver(facultyFormSchema),
    defaultValues: { name: "", universityIds: [] },
  });

  const options = useMemo(() => {
    const byId = new Map<string, string>();
    for (const university of universities.data?.items ?? [])
      byId.set(university.id, university.name);
    for (const university of editing?.universities ?? []) byId.set(university.id, university.name);
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [universities.data, editing]);

  const { reset } = form;
  const { isDirty } = form.formState;
  useEffect(() => {
    reset({
      name: editing?.name ?? "",
      universityIds: editing?.universities.map((university) => university.id) ?? [],
    });
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

  async function saveName(values: FacultyFormValues): Promise<{ id: string; name: string }> {
    if (editing === null) return create.mutateAsync({ data: { name: values.name } });
    if (values.name === editing.name) return editing;
    return update.mutateAsync({ id: editing.id, data: { name: values.name } });
  }

  async function changeLinks(facultyId: string, values: FacultyFormValues) {
    const current = new Set(editing?.universities.map((university) => university.id) ?? []);
    const wanted = new Set(values.universityIds);
    const nameOf = (id: string) =>
      options.find((option) => option.id === id)?.name ?? "a university";
    const blocked: string[] = [];
    const failed: string[] = [];
    for (const id of current) {
      if (wanted.has(id)) continue;
      try {
        await unassign.mutateAsync({ id: facultyId, universityId: id });
      } catch (error) {
        (isApiError(error) && error.code === "DIRECTORY_IN_USE" ? blocked : failed).push(
          nameOf(id),
        );
      }
    }
    for (const id of wanted) {
      if (current.has(id)) continue;
      try {
        await assign.mutateAsync({ id: facultyId, universityId: id });
      } catch {
        failed.push(nameOf(id));
      }
    }
    return { blocked, failed };
  }

  async function onSubmit(values: FacultyFormValues) {
    let saved: { id: string; name: string };
    try {
      saved = await saveName(values);
    } catch (error) {
      if (isApiError(error) && error.code === "DIRECTORY_NAME_TAKEN") {
        form.setError("name", { type: "server", message: facultyNameTakenMessage });
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
      return;
    }
    const problems = await changeLinks(saved.id, values);
    if (problems.blocked.length > 0 || problems.failed.length > 0) {
      onSaved(linkProblemMessage(saved.name, problems), true);
    } else {
      onSaved(editing === null ? `${saved.name} was added.` : `${saved.name} was saved.`, false);
    }
    close();
  }

  return (
    <Sheet open={target !== null} onOpenChange={(next) => (next ? undefined : requestClose())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{editing === null ? "Add a faculty" : "Edit faculty"}</SheetTitle>
          <SheetDescription>
            A faculty can be offered by several universities. Departments are added to a faculty at
            a university.
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
          <FormField<FacultyFormValues, "universityIds">
            name="universityIds"
            label="Universities"
            description="Tick every university that offers this faculty."
            render={({ field, controlProps }) => (
              <div
                role="group"
                aria-label="Universities"
                id={controlProps.id}
                className="flex flex-col gap-2"
              >
                {universities.isPending && options.length === 0 ? (
                  <FieldDescription role="status">Loading universities</FieldDescription>
                ) : null}
                {universities.isError ? (
                  <FieldDescription role="alert">
                    The universities could not be loaded. Close this form and try again.
                  </FieldDescription>
                ) : null}
                {universities.isSuccess && options.length === 0 ? (
                  <FieldDescription>No universities yet. Add a university first.</FieldDescription>
                ) : null}
                {options.map((option) => {
                  const boxId = `${controlProps.id}-${option.id}`;
                  return (
                    <Field key={option.id} orientation="horizontal">
                      <Checkbox
                        id={boxId}
                        checked={field.value.includes(option.id)}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next
                              ? [...field.value, option.id]
                              : field.value.filter((id) => id !== option.id),
                          )
                        }
                      />
                      <FieldLabel htmlFor={boxId}>{option.name}</FieldLabel>
                    </Field>
                  );
                })}
              </div>
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
