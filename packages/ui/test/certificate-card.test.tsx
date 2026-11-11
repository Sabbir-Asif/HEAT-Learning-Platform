import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CertificateCard } from "../src/composites/certificate-card";

afterEach(cleanup);

const ready = {
  courseTitle: "HEAT",
  status: "ready" as const,
  number: "AB-1",
  issuedLabel: "12 November 2026",
  verificationUrl: "https://learn.example/verify/AB-1",
  downloadHref: "/api/certificates/c1/download",
};

describe("CertificateCard", () => {
  test("ready shows the link, a download anchor and calls onCopyLink", () => {
    const onCopyLink = vi.fn();
    render(<CertificateCard {...ready} onCopyLink={onCopyLink} />);

    expect((screen.getByLabelText("Verification link") as HTMLInputElement).value).toBe(
      ready.verificationUrl,
    );
    expect(
      screen
        .getByText(/Download PDF/)
        .closest("a")
        ?.getAttribute("href"),
    ).toBe(ready.downloadHref);
    fireEvent.click(screen.getByRole("button", { name: "Copy verification link for HEAT" }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  test("pending has no download link and explains the state", () => {
    render(<CertificateCard courseTitle="HEAT" status="pending" />);

    expect(document.querySelector("a")).toBeNull();
    expect(screen.getByText("Being prepared")).toBeTruthy();
    expect(screen.getByText(/being prepared\. It will appear/)).toBeTruthy();
  });

  test("revoked has no download or copy even when they are passed", () => {
    render(<CertificateCard {...ready} status="revoked" />);

    expect(document.querySelector("a")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/has been revoked/)).toBeTruthy();
    expect(screen.getByText("Revoked")).toBeTruthy();
  });
});
