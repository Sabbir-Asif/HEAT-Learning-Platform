import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export const createClient = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
