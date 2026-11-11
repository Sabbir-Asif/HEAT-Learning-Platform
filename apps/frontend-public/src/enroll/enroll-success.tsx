import { FieldDescription, PageHeader } from "@heat/ui";

interface EnrollSuccessProps {
  email: string;
}

export function EnrollSuccess({ email }: EnrollSuccessProps) {
  return (
    <div className="flex flex-col gap-3" role="status">
      <PageHeader title="Check your email" />
      <FieldDescription>
        We sent a verification link to {email}. Open it to verify your email address, then sign in.
      </FieldDescription>
    </div>
  );
}
