import { z } from "zod";

export const certificateConfigKeys = [
  "PUBLIC_APP_URL",
  "CERTIFICATE_TITLE",
  "CERTIFICATE_INTRO",
  "CERTIFICATE_COMPLETION",
  "CERTIFICATE_VERIFY_LABEL",
  "CERTIFICATE_ORGANISATION_NAME",
  "CERTIFICATE_ORGANISATION_ADDRESS",
  "CERTIFICATE_SIGNATORY_ONE_NAME",
  "CERTIFICATE_SIGNATORY_ONE_TITLE",
  "CERTIFICATE_SIGNATORY_TWO_NAME",
  "CERTIFICATE_SIGNATORY_TWO_TITLE",
] as const;

export type CertificateConfigKey = (typeof certificateConfigKeys)[number];

const text = (fallback: string) => z.string().trim().min(1).max(200).default(fallback);

const publicAppUrl = z
  .string()
  .default("http://localhost:3000")
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const { protocol, pathname, search, hash } = new URL(value);
    return (
      (protocol === "https:" || protocol === "http:") &&
      pathname === "/" &&
      search === "" &&
      hash === ""
    );
  }, "PUBLIC_APP_URL must be an absolute http or https origin without a path");

const certificateEnvSchema = z.object({
  PUBLIC_APP_URL: publicAppUrl,
  CERTIFICATE_TITLE: text("Certificate of Completion"),
  CERTIFICATE_INTRO: text("This is to certify that"),
  CERTIFICATE_COMPLETION: text("has successfully completed the course"),
  CERTIFICATE_VERIFY_LABEL: text("Verify this certificate at"),
  CERTIFICATE_ORGANISATION_NAME: text("Women Safety Awareness Program, University of Dhaka"),
  CERTIFICATE_ORGANISATION_ADDRESS: text("University of Dhaka, Dhaka 1000, Bangladesh"),
  CERTIFICATE_SIGNATORY_ONE_NAME: text("Name of the Project Director"),
  CERTIFICATE_SIGNATORY_ONE_TITLE: text("Project Director, Women Safety Awareness Program"),
  CERTIFICATE_SIGNATORY_TWO_NAME: text("Name of the Vice-Chancellor"),
  CERTIFICATE_SIGNATORY_TWO_TITLE: text("Vice-Chancellor, University of Dhaka"),
});

export interface CertificateSignatory {
  name: string;
  title: string;
}

export interface CertificateConfig {
  verifyBaseUrl: string;
  wording: { title: string; intro: string; completion: string; verifyLabel: string };
  organisation: { name: string; address: string };
  signatories: [CertificateSignatory, CertificateSignatory];
}

export const loadCertificateConfig = (
  env: Partial<Record<string, string | undefined>>,
): CertificateConfig => {
  const picked = Object.fromEntries(
    certificateConfigKeys.map((key) => [key, env[key] === "" ? undefined : env[key]]),
  );
  const parsed = certificateEnvSchema.parse(picked);
  return {
    verifyBaseUrl: parsed.PUBLIC_APP_URL,
    wording: {
      title: parsed.CERTIFICATE_TITLE,
      intro: parsed.CERTIFICATE_INTRO,
      completion: parsed.CERTIFICATE_COMPLETION,
      verifyLabel: parsed.CERTIFICATE_VERIFY_LABEL,
    },
    organisation: {
      name: parsed.CERTIFICATE_ORGANISATION_NAME,
      address: parsed.CERTIFICATE_ORGANISATION_ADDRESS,
    },
    signatories: [
      {
        name: parsed.CERTIFICATE_SIGNATORY_ONE_NAME,
        title: parsed.CERTIFICATE_SIGNATORY_ONE_TITLE,
      },
      {
        name: parsed.CERTIFICATE_SIGNATORY_TWO_NAME,
        title: parsed.CERTIFICATE_SIGNATORY_TWO_TITLE,
      },
    ],
  };
};
