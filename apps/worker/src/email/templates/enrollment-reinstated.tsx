import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { text } from "../email-variables";

export const enrollmentReinstated = defineEmailTemplate({
  key: "enrollment-reinstated",
  category: "ENROLLMENT",
  schema: z.object({ name: text, courseTitle: text }),
  subject: ({ courseTitle }) => `Your enrollment in ${courseTitle} is active again`,
  body: ({ name, courseTitle }, context) => (
    <EmailLayout preview="Your enrollment is active again" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>{`Your enrollment in ${courseTitle} has been reinstated. Your progress is kept.`}</Paragraph>
      <ActionLink
        label="Go to your dashboard"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/dashboard")}
      />
    </EmailLayout>
  ),
});
