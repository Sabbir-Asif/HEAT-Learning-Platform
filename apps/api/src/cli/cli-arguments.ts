export const commandName = "recover-super-admin";

export const usage = `Usage: ${commandName} [--email <address>]`;

export type ParsedArguments =
  { ok: true; email: string | undefined } | { ok: false; message: string };

const failure = (): ParsedArguments => ({ ok: false, message: usage });

export const parseArguments = (argv: readonly string[]): ParsedArguments => {
  const [command, ...rest] = argv;
  if (command !== commandName) return failure();
  if (rest.length === 0) return { ok: true, email: undefined };
  let value: string | undefined;
  if (rest.length === 1 && rest[0]?.startsWith("--email=")) {
    value = rest[0].slice("--email=".length);
  } else if (rest.length === 2 && rest[0] === "--email") {
    value = rest[1];
  } else {
    return failure();
  }
  const email = value?.trim() ?? "";
  return email === "" ? failure() : { ok: true, email };
};
