import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ivLength = 12;
const tagLength = 16;

export class SecretBox {
  constructor(private readonly key: Buffer) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }

  decrypt(sealed: string): string {
    const data = Buffer.from(sealed, "base64url");
    if (data.length < ivLength + tagLength) throw new Error("Sealed value is too short");
    const decipher = createDecipheriv("aes-256-gcm", this.key, data.subarray(0, ivLength));
    decipher.setAuthTag(data.subarray(ivLength, ivLength + tagLength));
    return Buffer.concat([
      decipher.update(data.subarray(ivLength + tagLength)),
      decipher.final(),
    ]).toString("utf8");
  }
}
