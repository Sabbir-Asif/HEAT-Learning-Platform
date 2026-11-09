import { argon2id, hash } from "argon2";

export const hashPassword = (password: string): Promise<string> =>
  hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
