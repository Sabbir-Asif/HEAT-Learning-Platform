"use client";

import type { CourseSummaryDto } from "@heat/api-client";
import {
  Button,
  FieldDescription,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@heat/ui";
import { useState } from "react";
import { CourseForm } from "./course-form";
import { unsavedChangesMessage } from "./courses-copy";

type CourseFormSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (course: CourseSummaryDto) => void | Promise<void>;
};

export function CourseFormSheet({ open, onClose, onCreated }: CourseFormSheetProps) {
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  function close() {
    setDiscarding(false);
    setDirty(false);
    onClose();
  }

  function requestClose() {
    if (dirty && !discarding) {
      setDiscarding(true);
      return;
    }
    close();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : requestClose())}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Add a course</SheetTitle>
          <SheetDescription>
            The course starts as a draft. Add modules, videos and quizzes, then publish it.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          {open ? (
            <CourseForm
              course={null}
              onDirtyChange={setDirty}
              onCancel={requestClose}
              onSaved={async (course) => {
                await onCreated(course);
                close();
              }}
            />
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
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
