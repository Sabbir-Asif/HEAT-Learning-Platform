import type { CertificateItem } from "@heat/contracts";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CertificatesScreen } from "../../src/certificates/certificates-screen";
import { mount } from "../learn/mount";

const useMeCertificatesList = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useMeCertificatesList: (...args: unknown[]) => useMeCertificatesList(...args),
}));

vi.mock("@heat/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/ui")>()),
  toast,
}));

beforeEach(() => {
  useMeCertificatesList.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const item = (overrides: Partial<CertificateItem> = {}): CertificateItem => ({
  id,
  courseId: id,
  courseTitle: "HEAT Gender Safety",
  status: "READY",
  number: "AB-1",
  issuedAt: "2026-11-12T10:00:00.000Z",
  verificationUrl: "https://learn.example/verify/AB-1",
  ...overrides,
});

const ready = (certificates: CertificateItem[]) =>
  useMeCertificatesList.mockReturnValue({
    isPending: false,
    isError: false,
    data: { certificates },
  });

describe("CertificatesScreen", () => {
  test("a ready certificate offers a download link and the verification link", async () => {
    ready([item()]);

    const view = await mount(<CertificatesScreen />);

    expect(view.querySelector(`a[href="/api/certificates/${id}/download"]`)).not.toBeNull();
    expect((view.querySelector("input") as HTMLInputElement).value).toBe(
      "https://learn.example/verify/AB-1",
    );
  });

  test("copy puts the full link on the clipboard and shows a confirmation toast", async () => {
    ready([item()]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const view = await mount(<CertificatesScreen />);

    await act(async () =>
      (
        view.querySelector("button[aria-label^='Copy verification link']") as HTMLButtonElement
      ).click(),
    );

    expect(writeText).toHaveBeenCalledWith("https://learn.example/verify/AB-1");
    expect(toast.success).toHaveBeenCalledWith("Verification link copied");
    vi.unstubAllGlobals();
  });

  test("a pending certificate shows its state and no download", async () => {
    ready([
      item({ id: null, status: "PENDING", number: null, issuedAt: null, verificationUrl: null }),
    ]);

    const view = await mount(<CertificatesScreen />);

    expect(view.textContent).toContain("Being prepared");
    expect(view.querySelector("a")).toBeNull();
  });

  test("a revoked certificate shows the revoked state and no download", async () => {
    ready([item({ status: "REVOKED" })]);

    const view = await mount(<CertificatesScreen />);

    expect(view.textContent).toContain("Revoked");
    expect(view.querySelector("a")).toBeNull();
  });

  test("shows the loading state", async () => {
    useMeCertificatesList.mockReturnValue({ isPending: true, isError: false });

    const view = await mount(<CertificatesScreen />);

    expect(view.querySelector('[data-slot="certificates-loading"]')).not.toBeNull();
  });

  test("shows an error with a retry", async () => {
    const refetch = vi.fn();
    useMeCertificatesList.mockReturnValue({ isPending: false, isError: true, refetch });

    const view = await mount(<CertificatesScreen />);
    const retry = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    expect(refetch).toHaveBeenCalled();
  });

  test("shows an empty state", async () => {
    ready([]);

    const view = await mount(<CertificatesScreen />);

    expect(view.textContent).toContain("No certificates yet");
  });
});
