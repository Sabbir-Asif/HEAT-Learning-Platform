"use client";

import { useAdminAuthSignOut } from "@heat/api-client";
import { Button } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { signInPath } from "./sign-in-location";

export function SignOutButton() {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useAdminAuthSignOut();

  function signOut() {
    mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        window.location.assign(signInPath);
      },
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={isPending}>
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  );
}
