import { loadConfig } from "../core";
import { runCli } from "./run-cli";
import type { CliOutput, Recoverer } from "./run-cli";

export interface CliSession {
  recoverer: Recoverer;
  close: () => Promise<void>;
}

export interface ExecuteOptions {
  argv: readonly string[];
  open: () => Promise<CliSession>;
  output: CliOutput;
  hostname: string;
  environment: NodeJS.ProcessEnv;
}

const startupMessage = (environment: NodeJS.ProcessEnv): string => {
  try {
    loadConfig(environment);
    return "Recovery failed to start. Check the database and Redis connections.";
  } catch (error) {
    return error instanceof Error ? error.message : "Recovery failed to start.";
  }
};

export const executeCli = async (options: ExecuteOptions): Promise<number> => {
  let session: CliSession;
  try {
    session = await options.open();
  } catch {
    options.output.err(`${startupMessage(options.environment)}\n`);
    return 1;
  }
  try {
    return await runCli(options.argv, session.recoverer, options.output, options.hostname);
  } finally {
    await session.close().catch(() => undefined);
  }
};
