const maxNameLength = 80;

function normalise(value: string): string {
  return value.normalize("NFC").trim();
}

export function nameConfirmationApplies(name: string | undefined): name is string {
  if (name === undefined) return false;
  const normalised = normalise(name);
  return normalised.length > 0 && normalised.length <= maxNameLength;
}

export function isNameConfirmation(name: string, typed: string): boolean {
  return normalise(typed) === normalise(name);
}
