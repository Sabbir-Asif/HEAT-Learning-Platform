export interface EmailContext {
  publicAppUrl: string;
  adminAppUrl: string;
  supportAddress: string;
}

export class EmailTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailTemplateError";
  }
}

const assertOrigin = (value: string, name: string): string => {
  if (!URL.canParse(value)) throw new EmailTemplateError(`${name} is not a valid URL`);
  const parsed = new URL(value);
  const isWeb = parsed.protocol === "https:" || parsed.protocol === "http:";
  if (!isWeb || parsed.origin !== value) {
    throw new EmailTemplateError(`${name} must be an http or https origin without a path`);
  }
  return parsed.origin;
};

export const buildLink = (
  baseUrl: string,
  baseName: string,
  path: string,
  segment?: string,
): string => {
  const origin = assertOrigin(baseUrl, baseName);
  const tail = segment === undefined ? "" : `/${encodeURIComponent(segment)}`;
  return `${origin}${path}${tail}`;
};
