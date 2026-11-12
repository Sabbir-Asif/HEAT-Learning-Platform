import { z } from "zod";
import { buildLink } from "../email-context";
import { EmailLayout } from "../email-layout";
import { ActionLink, Paragraph } from "../email-parts";
import { defineEmailTemplate } from "../email-template";
import { opaque, text } from "../email-variables";

export const certificateReady = defineEmailTemplate({
  key: "certificate-ready",
  category: "CERTIFICATE",
  schema: z.object({ name: text, courseTitle: text, certificateCode: opaque }),
  subject: ({ courseTitle }) => `Your certificate for ${courseTitle} is ready`,
  body: ({ name, courseTitle, certificateCode }, context) => (
    <EmailLayout preview="Your certificate is ready" supportAddress={context.supportAddress}>
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>{`Congratulations on completing ${courseTitle}. Your certificate is attached as a PDF.`}</Paragraph>
      <ActionLink
        label="Verify your certificate"
        href={buildLink(
          context.publicAppUrl,
          "publicAppUrl",
          "/verify-certificate",
          certificateCode,
        )}
      />
      <ActionLink
        label="Download it from your account"
        href={buildLink(context.publicAppUrl, "publicAppUrl", "/certificates")}
      />
    </EmailLayout>
  ),
});
