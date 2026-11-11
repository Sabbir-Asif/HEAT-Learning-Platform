import { z } from "zod";
import { EmailLayout } from "../email-layout";
import { Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { reason, text } from "../email-variables";

export const enrollmentRemoved = defineEmailTemplate({
  key: "enrollment-removed",
  category: "ENROLLMENT",
  schema: z.object({ name: text, courseTitle: text, reason }),
  subject: ({ courseTitle }) => `You were removed from ${courseTitle}`,
  body: ({ name, courseTitle, reason: why }, context) => (
    <EmailLayout preview="Your enrollment was removed" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>{`Your enrollment in ${courseTitle} has been removed.`}</Paragraph>
      <Paragraph>{`Reason: ${why}`}</Paragraph>
      <Paragraph>If you think this is a mistake, contact support.</Paragraph>
    </EmailLayout>
  ),
});
