import { FieldDescription, PageHeader } from "@heat/ui";
import { safeNextPath } from "@/auth/next-path";
import { SignInForm } from "@/auth/sign-in-form";

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function Page({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;
  const requested = Array.isArray(next) ? next[0] : next;
  return (
    <>
      <PageHeader title="Sign in" />
      <FieldDescription>Use your administrator email and password.</FieldDescription>
      <SignInForm next={safeNextPath(requested)} />
    </>
  );
}
