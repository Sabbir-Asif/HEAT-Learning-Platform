import { FieldDescription, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ChangePasswordForm } from "@/auth/change-password-form";
import { SignOutButton } from "@/auth/sign-out-button";
import { verifySession } from "@/auth/session";

export default async function Page() {
  const { user } = await verifySession();
  return (
    <ShellContent>
      <PageHeader title="Account" action={<SignOutButton />} />
      <FieldDescription>
        {user.mustChangePassword
          ? "Set a new password before you continue. Until then no other page is available."
          : `Signed in as ${user.email}.`}
      </FieldDescription>
      <ChangePasswordForm forced={user.mustChangePassword} />
    </ShellContent>
  );
}
