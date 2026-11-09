"use client";

import * as React from "react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/sheet";
import { useIsMobile } from "../hooks/use-mobile";
import { isNameConfirmation, nameConfirmationApplies } from "./confirmation";

type ConfirmDialogProps = {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  itemName: string;
  description: string;
  confirmLabel: string;
  confirmationName?: string;
  destructive?: boolean;
  errorMessage?: string;
  onConfirm: () => void | Promise<void>;
};

function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  itemName,
  description,
  confirmLabel,
  confirmationName,
  destructive = false,
  errorMessage = "This could not be completed. Try again.",
  onConfirm,
}: ConfirmDialogProps) {
  const isMobile = useIsMobile();
  const [innerOpen, setInnerOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const inputId = React.useId();

  const isOpen = open ?? innerOpen;
  const needsName = nameConfirmationApplies(confirmationName);
  const confirmed = !needsName || isNameConfirmation(confirmationName, typed);

  function changeOpen(next: boolean) {
    if (pending) return;
    if (!next) {
      setTyped("");
      setFailed(false);
    }
    setInnerOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    if (pending || !confirmed) return;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      setPending(false);
      setTyped("");
      setInnerOpen(false);
      onOpenChange?.(false);
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={changeOpen}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent side={isMobile ? "bottom" : "right"} data-slot="confirm-dialog">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <p className="text-sm font-medium break-words">{itemName}</p>
          {needsName ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={inputId}>Type the name above to confirm</Label>
              <Input
                id={inputId}
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
          ) : null}
          {failed ? (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" disabled={pending} />}>Cancel</SheetClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!confirmed || pending}
            aria-busy={pending}
            onClick={confirm}
          >
            {pending ? "Working" : confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
