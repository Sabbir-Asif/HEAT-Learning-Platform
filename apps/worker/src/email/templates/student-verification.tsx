import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { opaque, text } from "../email-variables";

export const studentVerification = defineEmailTemplate({
  key: "student-verification",
  category: "VERIFICATION",
  schema: z.object({ name: text, token: opaque }),
  subject: () => "Verify your email address for HEAT",
  body: ({ name, token }, context) => (
    <EmailLayout preview="Verify your email address" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>
        Thank you for registering for HEAT. Please confirm that this is your email address.
      </Paragraph>
      <ActionLink
        label="Verify your email"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/verify-email", token)}
      />
      <Paragraph>If you did not register, you can ignore this message.</Paragraph>
    </EmailLayout>
  ),
});
