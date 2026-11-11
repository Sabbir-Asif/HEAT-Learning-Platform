import { join } from "node:path";
import type { HlsFilesystem } from "./hls-filesystem";

export const stagingPath = (root: string, assetKey: string, attemptId: string): string =>
  join(root, `.staging-${assetKey}-${attemptId}`);

export const outputPath = (root: string, assetKey: string): string => join(root, assetKey);

const asidePath = (root: string, assetKey: string, attemptId: string): string =>
  join(root, `.previous-${assetKey}-${attemptId}`);

export interface Publication {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export const publishDirectory = async (
  filesystem: HlsFilesystem,
  root: string,
  assetKey: string,
  staging: string,
  attemptId: string,
): Promise<Publication> => {
  const target = outputPath(root, assetKey);
  if (!(await filesystem.exists(target))) {
    await filesystem.rename(staging, target);
    return {
      commit: () => Promise.resolve(),
      rollback: () => filesystem.remove(target),
    };
  }
  const aside = asidePath(root, assetKey, attemptId);
  await filesystem.rename(target, aside);
  try {
    await filesystem.rename(staging, target);
  } catch (error) {
    await filesystem.rename(aside, target);
    throw error;
  }
  return {
    commit: () => filesystem.remove(aside).catch(() => undefined),
    rollback: async () => {
      await filesystem.remove(target);
      await filesystem.rename(aside, target);
    },
  };
};
