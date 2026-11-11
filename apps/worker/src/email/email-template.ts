import { render } from "@react-email/render";
import type { ReactElement } from "react";
import type { z } from "zod";
import { EmailTemplateError, type EmailContext } from "./email-context";

export const emailCategories = ["VERIFICATION", "PASSWORD", "ENROLLMENT", "CERTIFICATE"] as const;

export type EmailCategory = (typeof emailCategories)[number];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplate {
  key: string;
  category: EmailCategory;
  render: (variables: unknown, context: EmailContext) => Promise<RenderedEmail>;
}

interface EmailTemplateDefinition<Schema extends z.ZodType> {
  key: string;
  category: EmailCategory;
  schema: Schema;
  subject: (variables: z.output<Schema>) => string;
  body: (variables: z.output<Schema>, context: EmailContext) => ReactElement;
}

const singleLine = (value: string): string => value.replace(/\s+/g, " ").trim();

export const defineEmailTemplate = <Schema extends z.ZodType>(
  definition: EmailTemplateDefinition<Schema>,
): EmailTemplate => ({
  key: definition.key,
  category: definition.category,
  render: async (variables, context) => {
    const parsed = definition.schema.safeParse(variables);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
      throw new EmailTemplateError(
        `Template ${definition.key} has missing or invalid variables: ${fields.join(", ")}`,
      );
    }
    const element = definition.body(parsed.data, context);
    return {
      subject: singleLine(definition.subject(parsed.data)),
      html: await render(element),
      text: await render(element, { plainText: true }),
    };
  },
});
