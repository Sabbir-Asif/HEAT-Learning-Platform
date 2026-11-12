import { contactEmailHref, contactPhoneHref, hasContactDetails } from "@heat/contracts";
import type { PublicContactSettingsResponse } from "@heat/contracts";
import { EmptyState, PageHeader, SectionHeading } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { MailIcon } from "lucide-react";
import { contactLines } from "./links";

function Lines({ value }: { value: string }) {
  return (
    <>
      {contactLines(value).map((line) => (
        <p key={line} className="break-words">
          {line}
        </p>
      ))}
    </>
  );
}

export function ContactPage({ settings }: { settings: PublicContactSettingsResponse }) {
  if (!hasContactDetails(settings)) {
    return (
      <ShellContent>
        <PageHeader title="Contact" />
        <EmptyState
          icon={MailIcon}
          title="Contact details are not available yet"
          description="Check back soon."
        />
      </ShellContent>
    );
  }
  return (
    <ShellContent>
      <PageHeader title="Contact" />
      {settings.organisation === "" ? null : (
        <SectionHeading>{settings.organisation}</SectionHeading>
      )}
      <dl className="flex flex-col gap-4">
        {settings.address === "" ? null : (
          <div>
            <dt>
              <strong>Address</strong>
            </dt>
            <dd>
              <Lines value={settings.address} />
            </dd>
          </div>
        )}
        {settings.email === "" ? null : (
          <div>
            <dt>
              <strong>Email</strong>
            </dt>
            <dd>
              <a href={contactEmailHref(settings.email)}>{settings.email}</a>
            </dd>
          </div>
        )}
        {settings.phone === "" ? null : (
          <div>
            <dt>
              <strong>Phone</strong>
            </dt>
            <dd>
              <a href={contactPhoneHref(settings.phone)}>{settings.phone}</a>
            </dd>
          </div>
        )}
        {settings.officeHours === "" ? null : (
          <div>
            <dt>
              <strong>Office hours</strong>
            </dt>
            <dd>
              <Lines value={settings.officeHours} />
            </dd>
          </div>
        )}
      </dl>
    </ShellContent>
  );
}
