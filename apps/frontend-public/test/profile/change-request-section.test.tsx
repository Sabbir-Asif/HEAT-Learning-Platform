import type { ProfileResponseDto } from "@heat/api-client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChangeRequestSection } from "../../src/profile/change-request-section";
import { mount } from "../learn/mount";

const useProfileChangeLatest = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useProfileChangeLatest: (...args: unknown[]) => useProfileChangeLatest(...args),
}));

vi.mock("../../src/profile/change-request-form", () => ({
  ChangeRequestForm: () => <form aria-label="Change request" />,
}));

beforeEach(() => useProfileChangeLatest.mockReset());

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const profile: ProfileResponseDto = {
  name: "Anne Smith",
  email: "anne@example.test",
  emailVerified: true,
  university: { id, name: "University of Dhaka" },
  faculty: { id, name: "Science" },
  department: { id, name: "Physics" },
  session: "2020-21",
  locked: true,
  avatarUrl: null,
};

const request = (status: string, reason: string | null = null) => ({
  id,
  status,
  requested: {
    name: "Anne Jones",
    university: null,
    faculty: null,
    department: null,
    session: null,
  },
  note: "Married name",
  reason,
  createdAt: "2026-11-17T04:00:00.000Z",
  decidedAt: null,
});

const settled = (value: unknown) =>
  useProfileChangeLatest.mockReturnValue({
    isPending: false,
    isError: false,
    data: { request: value },
  });

describe("ChangeRequestSection", () => {
  test("shows a loading state while the latest request loads", async () => {
    useProfileChangeLatest.mockReturnValue({ isPending: true, isError: false });

    const view = await mount(<ChangeRequestSection profile={profile} />);

    expect(view.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(view.querySelector("form")).toBeNull();
  });

  test("shows an error state with a retry when the request cannot load", async () => {
    const refetch = vi.fn();
    useProfileChangeLatest.mockReturnValue({ isPending: false, isError: true, refetch });

    const view = await mount(<ChangeRequestSection profile={profile} />);

    expect(view.textContent).toContain("Request a change");
    expect(view.querySelector("form")).toBeNull();
    expect(view.querySelector("button")).not.toBeNull();
  });

  test("offers the form when the student never asked", async () => {
    settled(null);

    const view = await mount(<ChangeRequestSection profile={profile} />);

    expect(view.querySelector("form[aria-label='Change request']")).not.toBeNull();
  });

  test("shows the open request and hides the form while it waits", async () => {
    settled(request("PENDING"));

    const view = await mount(<ChangeRequestSection profile={profile} />);

    expect(view.textContent).toContain("waiting for an admin");
    expect(view.textContent).toContain("Name: Anne Jones");
    expect(view.textContent).toContain("Note: Married name");
    expect(view.querySelector("form")).toBeNull();
  });

  test("shows the rejection reason and lets the student send a new request", async () => {
    settled(request("REJECTED", "The name does not match your records"));

    const view = await mount(<ChangeRequestSection profile={profile} />);

    expect(view.textContent).toContain("was not approved");
    expect(view.textContent).toContain("Reason: The name does not match your records");
    expect(view.querySelector("form[aria-label='Change request']")).not.toBeNull();
  });
});
