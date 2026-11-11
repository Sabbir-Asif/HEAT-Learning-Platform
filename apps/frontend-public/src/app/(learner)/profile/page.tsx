import { FieldDescription } from "@heat/ui";
import { ResendVerificationForm } from "@/awaiting/resend-verification-form";
import { verifySession } from "@/auth/session";
import { SignOutButton } from "@/auth/sign-out-button";
import { PlaceholderPage } from "@/shell/placeholder-page";

export default async function Page() {
  const { user } = await verifySession();
  return (
    <PlaceholderPage title="Profile" action={<SignOutButton />}>
      {user.emailVerified ? null : (
        <>
          <FieldDescription>Your email address is not verified yet.</FieldDescription>
          <ResendVerificationForm defaultEmail={user.email} />
        </>
      )}
    </PlaceholderPage>
  );
}
