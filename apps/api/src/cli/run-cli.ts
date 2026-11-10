import { parseArguments } from "./cli-arguments";
import { RecoveryError } from "./recover-super-admin.service";
import type { RecoveryOptions, RecoveryResult } from "./recover-super-admin.service";

export interface CliOutput {
  out: (text: string) => void;
  err: (text: string) => void;
}

export interface Recoverer {
  recover: (options: RecoveryOptions) => Promise<RecoveryResult>;
}

export const runCli = async (
  argv: readonly string[],
  recoverer: Recoverer,
  output: CliOutput,
  hostname: string,
): Promise<number> => {
  const parsed = parseArguments(argv);
  if (!parsed.ok) {
    output.err(`${parsed.message}\n`);
    return 2;
  }
  try {
    const result = await recoverer.recover({
      hostname,
      ...(parsed.email === undefined ? {} : { email: parsed.email }),
    });
    output.out(
      `Super admin ${result.email} was reset. All its sessions were revoked.\n` +
        `Temporary password (shown once, change it at the next sign-in):\n${result.temporaryPassword}\n`,
    );
    return 0;
  } catch (error) {
    output.err(
      error instanceof RecoveryError
        ? `Recovery refused: ${error.message}\n`
        : "Recovery failed unexpectedly. Check the database connection and try again.\n",
    );
    return 1;
  }
};
