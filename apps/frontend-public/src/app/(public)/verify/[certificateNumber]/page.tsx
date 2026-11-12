import { certificateVerifyVerify } from "@heat/api-client/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { VerificationRateLimited } from "@/verify/verification-rate-limited";
import { VerificationScreen } from "@/verify/verification-screen";
import {
  decodeCertificateNumber,
  isNotFoundFailure,
  isRateLimitedFailure,
  toVerificationModel,
  visitorAddressHeaders,
} from "@/verify/verification-view";

interface VerifyPageProps {
  params: Promise<{ certificateNumber: string }>;
}

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: VerifyPageProps) {
  const { certificateNumber } = await params;
  const number = decodeCertificateNumber(certificateNumber);
  if (number === null) notFound();
  const verification = await certificateVerifyVerify(number, {
    cache: "no-store",
    forwardCookies: false,
    headers: visitorAddressHeaders(await headers()),
  }).catch((error: unknown) => {
    if (isNotFoundFailure(error)) return null;
    if (isRateLimitedFailure(error)) return "rate-limited" as const;
    throw error;
  });
  if (verification === null) notFound();
  if (verification === "rate-limited") return <VerificationRateLimited />;
  return <VerificationScreen model={toVerificationModel(verification, number)} />;
}
