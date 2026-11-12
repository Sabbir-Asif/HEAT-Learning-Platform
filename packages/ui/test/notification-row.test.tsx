import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NotificationRow } from "../src/composites/notification-row";

afterEach(cleanup);

const renderRow = (props: Partial<React.ComponentProps<typeof NotificationRow>> = {}) =>
  render(
    <ul>
      <NotificationRow title="Approved" timeLabel="today" unread {...props} />
    </ul>,
  );

describe("NotificationRow", () => {
  test("announces an unread row and offers to mark it read", () => {
    const onMarkRead = vi.fn();
    renderRow({ onMarkRead });
    expect(screen.getByText("Unread:")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  test("a read row has no action and no unread label", () => {
    renderRow({ unread: false, onMarkRead: vi.fn() });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Unread:")).toBeNull();
  });

  test("shows the description when given", () => {
    renderRow({ description: "Start now" });
    expect(screen.getByText("Start now")).not.toBeNull();
  });
});
