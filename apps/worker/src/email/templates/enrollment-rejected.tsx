import { z } from "zod";
import { EmailLayout } from "../email-layout";
import { Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { reason, text } from "../email-variables";

export const enrollmentRejected = defineEmailTemplate({
  key: "enrollment-rejected",
  category: "ENROLLMENT",
  schema: z.object({ name: text, courseTitle: text, reason }),
  subject: ({ courseTitle }) => `Your enrollment request for ${courseTitle} was not approved`,
  body: ({ name, courseTitle, reason: why }, context) => (
    <EmailLayout preview="Your enrollment was not approved" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>{`Your enrollment request for ${courseTitle} was not approved.`}</Paragraph>
      <Paragraph>{`Reason: ${why}`}</Paragraph>
      <Paragraph>If you think this is a mistake, contact support.</Paragraph>
    </EmailLayout>
  ),
});
