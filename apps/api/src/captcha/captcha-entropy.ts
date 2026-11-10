import { randomInt } from "node:crypto";

export interface CaptchaEntropy {
  int(max: number): number;
  unit(): number;
}

export const CAPTCHA_ENTROPY = Symbol("CAPTCHA_ENTROPY");

const unitResolution = 1_000_000;

export const cryptoEntropy: CaptchaEntropy = {
  int: (max) => randomInt(max),
  unit: () => randomInt(unitResolution) / unitResolution,
};
