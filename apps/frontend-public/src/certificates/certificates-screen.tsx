"use client";

import { useMeCertificatesList } from "@heat/api-client";
import { CertificateCard, PageHeader, toast } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { copyVerificationLink } from "./copy-link";
import { toCertificateCardModel } from "./certificate-view";
import { CertificatesEmpty, CertificatesError, CertificatesLoading } from "./certificates-states";

const copyLink = (url: string) =>
  copyVerificationLink(url, {
    writeText: (text) => navigator.clipboard.writeText(text),
    onCopied: () => toast.success("Verification link copied"),
    onFailed: () => toast.error("The link could not be copied. Select it and copy it by hand."),
  });

export function CertificatesScreen() {
  const certificates = useMeCertificatesList();
  if (certificates.isPending) return <CertificatesLoading />;
  if (certificates.isError)
    return <CertificatesError onRetry={() => void certificates.refetch()} />;
  const models = certificates.data.certificates.map(toCertificateCardModel);
  if (models.length === 0) return <CertificatesEmpty />;
  return (
    <ShellContent>
      <PageHeader title="Certificates" />
      <ul className="grid gap-4 md:grid-cols-2">
        {models.map(({ key, verificationUrl, ...card }) => (
          <li key={key}>
            <CertificateCard
              {...card}
              {...(verificationUrl === undefined
                ? {}
                : { verificationUrl, onCopyLink: () => void copyLink(verificationUrl) })}
            />
          </li>
        ))}
      </ul>
    </ShellContent>
  );
}
