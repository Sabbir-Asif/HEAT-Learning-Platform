import type { CaptchaEntropy } from "./captcha-entropy";

export const alphabet = "ACDEFHJKMNPRTUVWXY23456789";

export const captchaLength = 6;

export const generateCaptchaText = (entropy: CaptchaEntropy): string =>
  Array.from({ length: captchaLength }, () => alphabet[entropy.int(alphabet.length)]).join("");

export const normaliseAnswer = (answer: string): string => answer.replace(/\s+/g, "").toUpperCase();
