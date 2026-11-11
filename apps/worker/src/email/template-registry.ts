import { EmailTemplateError, type EmailContext } from "./email-context";
import type { EmailCategory, EmailTemplate, RenderedEmail } from "./email-template";
import { adminInvitation } from "./templates/admin-invitation";
import { certificateReady } from "./templates/certificate-ready";
import { enrollmentApproved } from "./templates/enrollment-approved";
import { enrollmentReinstated } from "./templates/enrollment-reinstated";
import { enrollmentRejected } from "./templates/enrollment-rejected";
import { enrollmentRemoved } from "./templates/enrollment-removed";
import { passwordChangeCode } from "./templates/password-change-code";
import { passwordReset } from "./templates/password-reset";
import { studentAlreadyRegistered } from "./templates/student-already-registered";
import { studentVerification } from "./templates/student-verification";

const templates: readonly EmailTemplate[] = [
  studentVerification,
  studentAlreadyRegistered,
  passwordChangeCode,
  passwordReset,
  enrollmentApproved,
  enrollmentRejected,
  enrollmentRemoved,
  enrollmentReinstated,
  certificateReady,
  adminInvitation,
];

const byKey = new Map(templates.map((template) => [template.key, template]));

export const emailTemplateKeys: readonly string[] = templates.map((template) => template.key);

export const listEmailTemplates = (): { key: string; category: EmailCategory }[] =>
  templates.map(({ key, category }) => ({ key, category }));

export const renderEmail = (
  key: string,
  variables: unknown,
  context: EmailContext,
): Promise<RenderedEmail> => {
  const template = byKey.get(key);
  if (template === undefined) {
    return Promise.reject(new EmailTemplateError(`Unknown email template: ${key}`));
  }
  return template.render(variables, context);
};
