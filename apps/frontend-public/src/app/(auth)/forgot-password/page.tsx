import { FieldDescription, PageHeader } from "@heat/ui";
import { ForgotPasswordForm } from "@/password-reset/forgot-password-form";

export default function Page() {
  return (
    <>
      <PageHeader title="Forgot password" />
      <FieldDescription>
        Enter the email you enrolled with. Only verified addresses receive a reset link.
      </FieldDescription>
      <ForgotPasswordForm />
    </>
  );
}
