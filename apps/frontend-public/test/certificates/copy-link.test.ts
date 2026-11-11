import { describe, expect, test, vi } from "vitest";
import { copyVerificationLink } from "../../src/certificates/copy-link";

const deps = (writeText: (text: string) => Promise<void>) => ({
  writeText: vi.fn(writeText),
  onCopied: vi.fn(),
  onFailed: vi.fn(),
});

describe("copyVerificationLink", () => {
  test("copies the full link and confirms", async () => {
    const d = deps(async () => undefined);

    await expect(copyVerificationLink("https://learn.example/verify/AB-1", d)).resolves.toBe(true);

    expect(d.writeText).toHaveBeenCalledWith("https://learn.example/verify/AB-1");
    expect(d.onCopied).toHaveBeenCalledTimes(1);
    expect(d.onFailed).not.toHaveBeenCalled();
  });

  test("reports a failure instead of a confirmation when the clipboard refuses", async () => {
    const d = deps(async () => Promise.reject(new Error("denied")));

    await expect(copyVerificationLink("https://learn.example/verify/AB-1", d)).resolves.toBe(false);

    expect(d.onCopied).not.toHaveBeenCalled();
    expect(d.onFailed).toHaveBeenCalledTimes(1);
  });
});
