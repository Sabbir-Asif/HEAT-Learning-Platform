import { PageHeader } from "@heat/ui";
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
      <PageHeader
        title="Welcome back"
        description="Sign in with the email and password you enrolled with."
      />
      <SignInForm next={safeNextPath(requested)} />
    </>
  );
}
