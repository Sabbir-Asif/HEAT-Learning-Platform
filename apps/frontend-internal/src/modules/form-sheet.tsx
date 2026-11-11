"use client";

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
import { unsavedChangesMessage } from "./modules-copy";

type FormSheetProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: (controls: {
    onDirtyChange: (dirty: boolean) => void;
    requestClose: () => void;
    close: () => void;
  }) => React.ReactNode;
};

export function FormSheet({ open, title, description, onClose, children }: FormSheetProps) {
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
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          {open ? children({ onDirtyChange: setDirty, requestClose, close }) : null}
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
