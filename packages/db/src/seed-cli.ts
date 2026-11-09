import { createClient } from "./client";
import { seed, SeedConfigError, seedOptionsFromEnv } from "./seed";

const main = async (): Promise<number> => {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    process.stderr.write("Seed failed: DATABASE_URL is required\n");
    return 1;
  }
  const prisma = createClient(url);
  try {
    const summary = await seed(prisma, seedOptionsFromEnv(process.env));
    process.stdout.write(
      `Seed complete: super admin ${summary.superAdminCreated ? "created" : "already present"}, sample directory ${summary.sampleDirectory ? "included" : "skipped"}\n`,
    );
    return 0;
  } catch (error) {
    const message =
      error instanceof SeedConfigError ? error.message : "unexpected error while writing seed data";
    process.stderr.write(`Seed failed: ${message}\n`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
};

main().then((code) => {
  process.exitCode = code;
});
