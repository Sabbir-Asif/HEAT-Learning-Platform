import { FieldDescription, PageHeader } from "@heat/ui";
import { ResetPasswordForm } from "@/password-reset/reset-password-form";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: ResetPasswordPageProps) {
  const { token } = await params;
  return (
    <>
      <PageHeader title="Choose a new password" />
      <FieldDescription>
        You will be signed out everywhere and asked to sign in again.
      </FieldDescription>
      <ResetPasswordForm token={token} />
    </>
  );
}
