import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { opaque, text } from "../email-variables";

const dhakaFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  dateStyle: "long",
  timeStyle: "short",
  hourCycle: "h23",
});

export const adminInvitation = defineEmailTemplate({
  key: "admin-invitation",
  category: "PASSWORD",
  schema: z.object({ name: text, token: opaque, expiresAt: z.iso.datetime() }),
  subject: () => "You are invited to the WSAP admin console",
  body: ({ name, token, expiresAt }, context) => (
    <EmailLayout preview="Your admin invitation" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>
        You have been invited to the WSAP admin console. Set your password to begin.
      </Paragraph>
      <ActionLink
        label="Accept the invitation"
        href={buildLink(context.adminAppUrl, "adminAppUrl", "/accept-invite", token)}
      />
      <Paragraph>{`The invitation expires on ${dhakaFormat.format(new Date(expiresAt))} (Asia/Dhaka).`}</Paragraph>
    </EmailLayout>
  ),
});
