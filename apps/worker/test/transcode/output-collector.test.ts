import { describe, expect, test, vi } from "vitest";
import { collectOutput } from "../../src/transcode/output-collector";
import { FakeFilesystem } from "./fake-filesystem";

const dir = "/stage";
const playlist = (files: string[]): string =>
  ["#EXTM3U", ...files.flatMap((file) => ["#EXTINF:6.000000,", file]), "#EXT-X-ENDLIST", ""].join(
    "\n",
  );

describe("collectOutput", () => {
  test("reads the master, each playlist, missing segments and codecs", async () => {
    const filesystem = new FakeFilesystem();
    filesystem.files.set(`${dir}/master.m3u8`, "master");
    filesystem.files.set(
      `${dir}/360p/index.m3u8`,
      playlist(["segment_00000.ts", "segment_00001.ts"]),
    );
    filesystem.files.set(`${dir}/360p/segment_00000.ts`, "x");
    const codecs = { codecs: vi.fn().mockResolvedValue(["h264", "aac"]) };
    const snapshot = await collectOutput(filesystem, codecs, dir, ["360p", "480p"]);
    expect(snapshot.master).toBe("master");
    expect(snapshot.renditions[0]).toMatchObject({
      name: "360p",
      missingSegments: ["segment_00001.ts"],
      codecs: ["h264", "aac"],
    });
    expect(snapshot.renditions[1]).toEqual({
      name: "480p",
      playlist: null,
      missingSegments: [],
      codecs: null,
    });
    expect(codecs.codecs).toHaveBeenCalledTimes(1);
    expect(codecs.codecs).toHaveBeenCalledWith(`${dir}/360p/index.m3u8`);
  });

  test("does not look outside the rendition folder for an odd segment name", async () => {
    const filesystem = new FakeFilesystem();
    filesystem.files.set(`${dir}/360p/index.m3u8`, playlist(["../../etc/passwd"]));
    const exists = vi.spyOn(filesystem, "exists");
    const codecs = { codecs: vi.fn().mockResolvedValue(["h264"]) };
    const snapshot = await collectOutput(filesystem, codecs, dir, ["360p"]);
    expect(snapshot.renditions[0]?.missingSegments).toEqual([]);
    expect(exists).not.toHaveBeenCalled();
  });

  test("reports a missing master as null", async () => {
    const snapshot = await collectOutput(new FakeFilesystem(), { codecs: vi.fn() }, dir, []);
    expect(snapshot.master).toBeNull();
  });
});
