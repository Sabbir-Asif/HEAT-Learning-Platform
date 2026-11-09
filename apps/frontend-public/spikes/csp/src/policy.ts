export const THEME_SCRIPT_HASH = "sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk=";

export const THEME_STYLE_HASHES = [
  "sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk=",
  "sha256-skqujXORqzxt1aE0NNXxujEanPTX6raoqSscTV/Ww/Y=",
];

export interface PolicyOptions {
  nonce: string;
  development: boolean;
  scriptHashes?: string[];
}

export function buildPolicy({ nonce, development, scriptHashes = [] }: PolicyOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...scriptHashes.map((hash) => `'${hash}'`),
    "'strict-dynamic'",
  ];
  if (development) scriptSrc.push("'unsafe-eval'");
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src-elem 'self' ${THEME_STYLE_HASHES.map((hash) => `'${hash}'`).join(" ")}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /csp-report",
  ];
  return directives.join("; ");
}

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
