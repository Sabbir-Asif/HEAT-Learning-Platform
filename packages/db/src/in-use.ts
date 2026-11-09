export interface Usage {
  name: string;
  count: number;
}

export class RecordInUseError extends Error {
  readonly blockers: readonly Usage[];

  constructor(blockers: readonly Usage[]) {
    super(`Record is in use by ${blockers.map((usage) => usage.name).join(", ")}`);
    this.name = "RecordInUseError";
    this.blockers = blockers;
  }
}

export const assertNotInUse = (usages: readonly Usage[]): void => {
  const blockers = usages.filter((usage) => usage.count > 0);
  if (blockers.length > 0) {
    throw new RecordInUseError(blockers);
  }
};
