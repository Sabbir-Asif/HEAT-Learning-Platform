import { z } from "zod";
import { EmailLayout } from "../email-layout";
import { CodeLine, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { text } from "../email-variables";

export const passwordChangeCode = defineEmailTemplate({
  key: "password-change-code",
  category: "PASSWORD",
  schema: z.object({
    name: text,
    code: z.string().trim().min(4).max(12),
    expiresInMinutes: z.number().int().positive().max(1440),
  }),
  subject: () => "Your HEAT password change code",
  body: ({ name, code, expiresInMinutes }, context) => (
    <EmailLayout preview="Your password change code" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>Use this code to confirm your password change:</Paragraph>
      <CodeLine>{code}</CodeLine>
      <Paragraph>{`The code expires in ${expiresInMinutes} minutes.`}</Paragraph>
      <Paragraph>If you did not ask for this, change your password and tell support.</Paragraph>
    </EmailLayout>
  ),
});
