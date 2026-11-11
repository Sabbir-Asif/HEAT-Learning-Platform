import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { text } from "../email-variables";

export const studentAlreadyRegistered = defineEmailTemplate({
  key: "student-already-registered",
  category: "VERIFICATION",
  schema: z.object({ name: text }),
  subject: () => "You already have a HEAT account",
  body: ({ name }, context) => (
    <EmailLayout preview="You already have an account" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>
        Someone tried to register for HEAT with this email address, which already has an account.
      </Paragraph>
      <ActionLink
        label="Sign in"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/sign-in")}
      />
      <ActionLink
        label="Reset your password"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/forgot-password")}
      />
      <Paragraph>If this was not you, no action is needed.</Paragraph>
    </EmailLayout>
  ),
});
