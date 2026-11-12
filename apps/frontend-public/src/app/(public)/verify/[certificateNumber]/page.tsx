import { certificateVerifyVerify } from "@heat/api-client/server";
import { notFound } from "next/navigation";
import { VerificationScreen } from "@/verify/verification-screen";
import { isNotFoundFailure, toVerificationModel } from "@/verify/verification-view";

interface VerifyPageProps {
  params: Promise<{ certificateNumber: string }>;
}

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: VerifyPageProps) {
  const { certificateNumber } = await params;
  const number = decodeURIComponent(certificateNumber).trim().toUpperCase();
  const verification = await certificateVerifyVerify(number, {
    cache: "no-store",
    forwardCookies: false,
  }).catch((error: unknown) => {
    if (isNotFoundFailure(error)) return null;
    throw error;
  });
  if (verification === null) notFound();
  return <VerificationScreen model={toVerificationModel(verification, number)} />;
}
