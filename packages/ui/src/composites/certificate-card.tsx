"use client";

import { AwardIcon, BanIcon, CopyIcon, DownloadIcon, HourglassIcon } from "lucide-react";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card";
import { Input } from "../components/input";
import { cn } from "../lib/utils";

type CertificateCardStatus = "ready" | "pending" | "revoked";

type CertificateCardProps = Omit<React.ComponentProps<typeof Card>, "children" | "title"> & {
  courseTitle: string;
  status: CertificateCardStatus;
  number?: string;
  issuedLabel?: string;
  verificationUrl?: string;
  downloadHref?: string;
  onCopyLink?: () => void;
};

const badges = {
  ready: { label: "Ready", icon: AwardIcon, variant: "secondary" },
  pending: { label: "Being prepared", icon: HourglassIcon, variant: "outline" },
  revoked: { label: "Revoked", icon: BanIcon, variant: "destructive" },
} as const;

function CertificateCard({
  courseTitle,
  status,
  number,
  issuedLabel,
  verificationUrl,
  downloadHref,
  onCopyLink,
  className,
  ...props
}: CertificateCardProps) {
  const badge = badges[status];
  const BadgeIcon = badge.icon;
  const inputId = `certificate-link-${number ?? courseTitle}`;
  return (
    <Card
      data-slot="certificate-card"
      data-status={status}
      size="sm"
      className={cn("h-full", className)}
      {...props}
    >
      <CardHeader>
        <CardTitle>{courseTitle}</CardTitle>
        <CardAction>
          <Badge variant={badge.variant}>
            <BadgeIcon aria-hidden="true" />
            {badge.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "pending" ? (
          <CardDescription>
            Your certificate is being prepared. It will appear here as soon as it is ready.
          </CardDescription>
        ) : null}
        {status === "revoked" ? (
          <CardDescription>
            This certificate has been revoked and can no longer be downloaded.
          </CardDescription>
        ) : null}
        {number === undefined ? null : (
          <p className="text-muted-foreground text-sm break-words">
            Certificate number: <span className="text-foreground font-medium">{number}</span>
            {issuedLabel === undefined ? null : ` · Issued ${issuedLabel}`}
          </p>
        )}
        {status === "ready" && verificationUrl !== undefined ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-medium">
              Verification link
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={inputId}
                readOnly
                value={verificationUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onCopyLink}
                aria-label={`Copy verification link for ${courseTitle}`}
              >
                <CopyIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
        {status === "ready" && downloadHref !== undefined ? (
          <div>
            <Button nativeButton={false} render={<a href={downloadHref} />}>
              <DownloadIcon aria-hidden="true" data-icon="inline-start" />
              Download PDF
              <span className="sr-only"> for {courseTitle}</span>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { CertificateCard };
export type { CertificateCardProps, CertificateCardStatus };
