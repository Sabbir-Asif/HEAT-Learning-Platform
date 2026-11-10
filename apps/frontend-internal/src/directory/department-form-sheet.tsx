"use client";

import {
  isApiError,
  useDepartmentsCreate,
  useDepartmentsUpdate,
  useFacultiesList,
  useUniversitiesList,
} from "@heat/api-client";
import type { DepartmentSummaryDto } from "@heat/api-client";
import { createDepartmentRequestSchema } from "@heat/contracts";
import type { CreateDepartmentRequest } from "@heat/contracts";
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
import { useForm, useWatch } from "react-hook-form";
import {
  departmentMoveBlockedMessage,
  departmentNameTakenMessage,
  unsavedChangesMessage,
} from "./directory-copy";

export type DepartmentFormTarget = DepartmentSummaryDto | "create" | null;

type DepartmentFormSheetProps = {
  target: DepartmentFormTarget;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const optionLimit = 50;

export function DepartmentFormSheet({ target, onClose, onSaved }: DepartmentFormSheetProps) {
  const create = useDepartmentsCreate();
  const update = useDepartmentsUpdate();
  const [discarding, setDiscarding] = useState(false);
  const editing = target !== null && target !== "create" ? target : null;
  const pairLocked = editing !== null && editing.studentCount > 0;
  const form = useForm<CreateDepartmentRequest>({
    resolver: zodResolver(createDepartmentRequestSchema),
    defaultValues: { name: "", universityId: "", facultyId: "" },
  });
  const universityId = useWatch({ control: form.control, name: "universityId" });
  const universities = useUniversitiesList(
    { page: 1, pageSize: optionLimit, sort: "name" },
    { query: { enabled: target !== null } },
  );
  const faculties = useFacultiesList(
    { page: 1, pageSize: optionLimit, sort: "name", universityId },
    { query: { enabled: target !== null && universityId !== "" } },
  );

  const universityItems = (universities.data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const facultyItems =
    universityId === ""
      ? []
      : (faculties.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }));

  const { reset } = form;
  const { isDirty } = form.formState;
  useEffect(() => {
    reset({
      name: editing?.name ?? "",
      universityId: editing?.university.id ?? "",
      facultyId: editing?.faculty.id ?? "",
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

  async function onSubmit(values: CreateDepartmentRequest) {
    try {
      const saved =
        editing === null
          ? await create.mutateAsync({ data: values })
          : await update.mutateAsync({ id: editing.id, data: values });
      onSaved(editing === null ? `${saved.name} was added.` : `${saved.name} was saved.`);
      close();
    } catch (error) {
      if (isApiError(error) && error.code === "DIRECTORY_NAME_TAKEN") {
        form.setError("name", { type: "server", message: departmentNameTakenMessage });
        return;
      }
      if (isApiError(error) && error.code === "DIRECTORY_IN_USE") {
        form.setError("root.server", { type: "server", message: departmentMoveBlockedMessage });
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
          <SheetTitle>{editing === null ? "Add a department" : "Edit department"}</SheetTitle>
          <SheetDescription>
            A department belongs to a university and one of the faculties that university offers.
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
          <FormField
            name="universityId"
            label="University"
            description={
              pairLocked ? "Departments with students cannot be moved to another university." : ""
            }
            render={({ field, controlProps }) => (
              <Select
                items={universityItems}
                value={field.value === "" ? null : field.value}
                disabled={pairLocked}
                onValueChange={(value) => {
                  field.onChange(value ?? "");
                  form.setValue("facultyId", "", { shouldDirty: true });
                }}
              >
                <SelectTrigger {...controlProps} className="w-full">
                  <SelectValue placeholder="Choose a university" />
                </SelectTrigger>
                <SelectContent>
                  {universityItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            name="facultyId"
            label="Faculty"
            description={
              universityId === ""
                ? "Choose a university first."
                : "Faculties this university offers."
            }
            render={({ field, controlProps }) => (
              <Select
                items={facultyItems}
                value={field.value === "" ? null : field.value}
                disabled={pairLocked || universityId === ""}
                onValueChange={(value) => field.onChange(value ?? "")}
              >
                <SelectTrigger {...controlProps} className="w-full">
                  <SelectValue placeholder="Choose a faculty" />
                </SelectTrigger>
                <SelectContent>
                  {facultyItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {universities.isError || faculties.isError ? (
            <FieldDescription role="alert">
              The universities or faculties could not be loaded. Close this form and try again.
            </FieldDescription>
          ) : null}
          {universities.isSuccess && universityItems.length === 0 ? (
            <FieldDescription>No universities yet. Add a university first.</FieldDescription>
          ) : null}
          {(universities.data?.total ?? 0) > optionLimit ||
          (faculties.data?.total ?? 0) > optionLimit ? (
            <FieldDescription>
              Only the first {optionLimit} names are listed. Search is not available here yet.
            </FieldDescription>
          ) : null}
          {faculties.isSuccess && universityId !== "" && facultyItems.length === 0 ? (
            <FieldDescription>
              This university offers no faculty yet. Assign one on the Faculties screen.
            </FieldDescription>
          ) : null}
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
