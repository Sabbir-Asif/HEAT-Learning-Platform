import "reflect-metadata";
import { hostname } from "node:os";
import { NestFactory } from "@nestjs/core";
import { CliModule } from "./cli.module";
import { executeCli } from "./execute-cli";
import { RecoverSuperAdminService } from "./recover-super-admin.service";

executeCli({
  argv: process.argv.slice(2),
  open: async () => {
    const context = await NestFactory.createApplicationContext(CliModule, {
      logger: ["error"],
    });
    return {
      recoverer: context.get(RecoverSuperAdminService),
      close: () => context.close(),
    };
  },
  output: {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  },
  hostname: hostname(),
  environment: process.env,
}).then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.stderr.write("Recovery failed unexpectedly.\n");
    process.exitCode = 1;
  },
);
