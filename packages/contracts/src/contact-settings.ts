import { z } from "zod";

export const contactSettingsKey = "contact-details";

export const contactOrganisationMaxLength = 160;
export const contactAddressMaxLength = 500;
export const contactEmailMaxLength = 254;
export const contactPhoneMaxLength = 24;
export const contactOfficeHoursMaxLength = 300;

export const contactPhonePattern = /^\+?[0-9][0-9 ()-]{4,22}[0-9]$/;

const limited = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`);

export const contactEmailSchema = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(contactEmailMaxLength, `Use at most ${contactEmailMaxLength} characters.`)
    .pipe(z.email("Enter a valid email address.")),
]);

export const contactPhoneSchema = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(contactPhoneMaxLength, `Use at most ${contactPhoneMaxLength} characters.`)
    .regex(contactPhonePattern, "Enter a valid phone number, for example +880 2 5566 7788."),
]);

export const contactSettingsRequestSchema = z.object({
  organisation: limited(contactOrganisationMaxLength),
  address: limited(contactAddressMaxLength),
  email: z.string().trim().pipe(contactEmailSchema),
  phone: z.string().trim().pipe(contactPhoneSchema),
  officeHours: limited(contactOfficeHoursMaxLength),
});

export type ContactSettingsRequest = z.infer<typeof contactSettingsRequestSchema>;

export const contactSettingsFormSchema = contactSettingsRequestSchema;

export type ContactSettingsFormValues = ContactSettingsRequest;

export const emptyContactSettings: ContactSettingsRequest = {
  organisation: "",
  address: "",
  email: "",
  phone: "",
  officeHours: "",
};

export const hasContactDetails = (settings: ContactSettingsRequest): boolean =>
  Object.values(settings).some((value) => value !== "");

export const contactPhoneHref = (phone: string): string => `tel:${phone.replace(/[^0-9+]/g, "")}`;

export const contactEmailHref = (email: string): string => `mailto:${email}`;

const contactSettingsContent = {
  organisation: z.string(),
  address: z.string(),
  email: z.string(),
  phone: z.string(),
  officeHours: z.string(),
};

export const publicContactSettingsResponseSchema = z.object(contactSettingsContent);

export type PublicContactSettingsResponse = z.infer<typeof publicContactSettingsResponseSchema>;

export const adminContactSettingsResponseSchema = z.object({
  ...contactSettingsContent,
  updatedAt: z.iso.datetime().nullable(),
});

export type AdminContactSettingsResponse = z.infer<typeof adminContactSettingsResponseSchema>;
