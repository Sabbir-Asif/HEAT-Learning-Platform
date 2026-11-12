import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useUnreadCount } from "../../src/notifications/use-unread-count";
import { mount } from "../learn/mount";

const useNotificationsUnreadCount = vi.fn();
const refetch = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useNotificationsUnreadCount: (...args: unknown[]) => useNotificationsUnreadCount(...args),
}));

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

function Probe() {
  return <p>{useUnreadCount()}</p>;
}

beforeEach(() => {
  refetch.mockReset();
  useNotificationsUnreadCount.mockReset();
  useNotificationsUnreadCount.mockReturnValue({ data: { count: 4 }, refetch });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

const lastInterval = () =>
  (useNotificationsUnreadCount.mock.lastCall?.[0] as { query: { refetchInterval: unknown } }).query
    .refetchInterval;

describe("useUnreadCount", () => {
  test("returns the count and polls every 60 seconds while visible", async () => {
    const view = await mount(<Probe />);
    expect(view.textContent).toBe("4");
    expect(lastInterval()).toBe(60_000);
  });

  test("returns 0 before data arrives", async () => {
    useNotificationsUnreadCount.mockReturnValue({ data: undefined, refetch });
    const view = await mount(<Probe />);
    expect(view.textContent).toBe("0");
  });

  test("stops polling when hidden and refreshes when visible again", async () => {
    await mount(<Probe />);
    await act(async () => setVisibility("hidden"));
    expect(lastInterval()).toBe(false);
    expect(refetch).not.toHaveBeenCalled();
    await act(async () => setVisibility("visible"));
    expect(lastInterval()).toBe(60_000);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
