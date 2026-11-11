import { randomBytes } from "node:crypto";

export const certificateNumberAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const certificateNumberPattern =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

const groupSize = 4;
const groupCount = 3;
const characterCount = groupSize * groupCount;
const alphabetMask = certificateNumberAlphabet.length - 1;

export const generateCertificateNumber = (
  fillRandom: (size: number) => Uint8Array = randomBytes,
): string => {
  const bytes = fillRandom(characterCount);
  const characters = Array.from(bytes, (byte) => certificateNumberAlphabet[byte & alphabetMask]);
  const groups: string[] = [];
  for (let index = 0; index < characterCount; index += groupSize) {
    groups.push(characters.slice(index, index + groupSize).join(""));
  }
  return groups.join("-");
};
