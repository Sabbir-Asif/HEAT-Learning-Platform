import { VerifyEmailView } from "@/verify-email/verify-email-view";

interface VerifyEmailPageProps {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: VerifyEmailPageProps) {
  const { token } = await params;
  return <VerifyEmailView token={token} />;
}
