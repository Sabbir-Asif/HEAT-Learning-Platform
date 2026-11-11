import { describe, expect, test } from "vitest";
import { outputPath, publishDirectory, stagingPath } from "../../src/transcode/hls-publish";
import { FakeFilesystem } from "./fake-filesystem";

const root = "/hls";
const key = "k".repeat(32);

const withOutput = (path: string, marker: string): FakeFilesystem => {
  const filesystem = new FakeFilesystem();
  filesystem.files.set(`${path}/master.m3u8`, marker);
  return filesystem;
};

describe("paths", () => {
  test("the output is named by the asset key and the staging name is hidden and unique", () => {
    expect(outputPath(root, key)).toBe(`/hls/${key}`);
    expect(stagingPath(root, key, "a1")).toBe(`/hls/.staging-${key}-a1`);
    expect(stagingPath(root, key, "a2")).not.toBe(stagingPath(root, key, "a1"));
  });
});

describe("publishDirectory", () => {
  test("renames the staging directory into place when nothing was published before", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a1"), "new");
    await publishDirectory(filesystem, root, key, stagingPath(root, key, "a1"), "a1");
    expect(filesystem.files.get(`/hls/${key}/master.m3u8`)).toBe("new");
    expect(filesystem.filesUnder(`/hls/.staging-${key}-a1`)).toEqual([]);
    expect(filesystem.log).toEqual([`rename /hls/.staging-${key}-a1 -> /hls/${key}`]);
  });

  test("moves the previous output aside, swaps the new one in and removes the old", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a2"), "new");
    filesystem.files.set(`/hls/${key}/master.m3u8`, "old");
    const publication = await publishDirectory(
      filesystem,
      root,
      key,
      stagingPath(root, key, "a2"),
      "a2",
    );
    expect(filesystem.files.get(`/hls/${key}/master.m3u8`)).toBe("new");
    expect(filesystem.files.get(`/hls/.previous-${key}-a2/master.m3u8`)).toBe("old");
    await publication.commit();
    expect(filesystem.filesUnder(`/hls/.previous-${key}-a2`)).toEqual([]);
    expect(filesystem.log).toEqual([
      `rename /hls/${key} -> /hls/.previous-${key}-a2`,
      `rename /hls/.staging-${key}-a2 -> /hls/${key}`,
      `remove /hls/.previous-${key}-a2`,
    ]);
  });

  test("restores the previous output and rethrows when the swap fails", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a4"), "new");
    filesystem.files.set(`/hls/${key}/master.m3u8`, "old");
    const original = filesystem.rename.bind(filesystem);
    let renames = 0;
    filesystem.rename = (from, to) => {
      renames += 1;
      return renames === 2 ? Promise.reject(new Error("disk full")) : original(from, to);
    };
    await expect(
      publishDirectory(filesystem, root, key, stagingPath(root, key, "a4"), "a4"),
    ).rejects.toThrow("disk full");
    expect(filesystem.files.get(`/hls/${key}/master.m3u8`)).toBe("old");
    expect(filesystem.files.get(`/hls/.staging-${key}-a4/master.m3u8`)).toBe("new");
  });

  test("keeps the published output when removing the old copy fails", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a5"), "new");
    filesystem.files.set(`/hls/${key}/master.m3u8`, "old");
    const publication = await publishDirectory(
      filesystem,
      root,
      key,
      stagingPath(root, key, "a5"),
      "a5",
    );
    filesystem.remove = () => Promise.reject(new Error("busy"));
    await expect(publication.commit()).resolves.toBeUndefined();
    expect(filesystem.files.get(`/hls/${key}/master.m3u8`)).toBe("new");
  });

  test("rolling back a first publish removes the output", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a6"), "new");
    const publication = await publishDirectory(
      filesystem,
      root,
      key,
      stagingPath(root, key, "a6"),
      "a6",
    );
    await publication.rollback();
    expect(filesystem.filesUnder(`/hls/${key}`)).toEqual([]);
  });

  test("rolling back a swap puts the previous output back", async () => {
    const filesystem = withOutput(stagingPath(root, key, "a7"), "new");
    filesystem.files.set(`/hls/${key}/master.m3u8`, "old");
    const publication = await publishDirectory(
      filesystem,
      root,
      key,
      stagingPath(root, key, "a7"),
      "a7",
    );
    await publication.rollback();
    expect(filesystem.files.get(`/hls/${key}/master.m3u8`)).toBe("old");
    expect(filesystem.filesUnder(`/hls/.previous-${key}-a7`)).toEqual([]);
  });
});
