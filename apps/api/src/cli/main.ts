import "reflect-metadata";
import { hostname } from "node:os";
import { NestFactory } from "@nestjs/core";
import { CliModule } from "./cli.module";
import { RecoverSuperAdminService } from "./recover-super-admin.service";
import { runCli } from "./run-cli";

const bootstrap = async (): Promise<number> => {
  const context = await NestFactory.createApplicationContext(CliModule, {
    logger: ["error"],
  });
  try {
    return await runCli(
      process.argv.slice(2),
      context.get(RecoverSuperAdminService),
      {
        out: (text) => process.stdout.write(text),
        err: (text) => process.stderr.write(text),
      },
      hostname(),
    );
  } finally {
    await context.close();
  }
};

bootstrap().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.stderr.write("Recovery failed to start. Check the environment configuration.\n");
    process.exitCode = 1;
  },
);
