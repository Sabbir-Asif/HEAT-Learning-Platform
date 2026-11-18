import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { opaque, text } from "../email-variables";

export const passwordReset = defineEmailTemplate({
  key: "password-reset",
  category: "PASSWORD",
  schema: z.object({ name: text, token: opaque }),
  subject: () => "Reset your WSAP password",
  body: ({ name, token }, context) => (
    <EmailLayout preview="Reset your password" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>We received a request to reset your password.</Paragraph>
      <ActionLink
        label="Choose a new password"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/reset-password", token)}
      />
      <Paragraph>If you did not ask for this, you can ignore this message.</Paragraph>
    </EmailLayout>
  ),
});
