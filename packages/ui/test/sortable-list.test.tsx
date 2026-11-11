import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SortableList, moveId } from "../src/composites/sortable-list";

afterEach(cleanup);

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

describe("moveId", () => {
  test("moves an id up and down by one place", () => {
    expect(moveId(["a", "b", "c"], "c", "up")).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", "down")).toEqual(["b", "a", "c"]);
  });

  test("returns null at either end and for an unknown id", () => {
    expect(moveId(["a", "b", "c"], "a", "up")).toBeNull();
    expect(moveId(["a", "b", "c"], "c", "down")).toBeNull();
    expect(moveId(["a", "b", "c"], "x", "up")).toBeNull();
  });
});

describe("SortableList", () => {
  test("move buttons name the item and the first up and last down are disabled", () => {
    render(<SortableList items={items} onReorder={() => undefined} />);
    expect(screen.getByRole("button", { name: "Move Alpha up" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Move Gamma down" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Move Beta up" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  test("reports the new order of ids when an item moves", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Gamma up" }));
    expect(onReorder).toHaveBeenCalledWith(["a", "c", "b"]);
  });

  test("focus follows the moved item to its new position", () => {
    const { rerender } = render(<SortableList items={items} onReorder={() => undefined} />);
    const button = screen.getByRole("button", { name: "Move Gamma up" });
    button.focus();
    fireEvent.click(button);
    rerender(
      <SortableList items={[items[0]!, items[2]!, items[1]!]} onReorder={() => undefined} />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Gamma up" }));
  });

  test("focus moves to the other button when the item reaches an end", () => {
    const { rerender } = render(<SortableList items={items} onReorder={() => undefined} />);
    const button = screen.getByRole("button", { name: "Move Beta up" });
    button.focus();
    fireEvent.click(button);
    rerender(
      <SortableList items={[items[1]!, items[0]!, items[2]!]} onReorder={() => undefined} />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Beta down" }));
  });

  test("keeps the pending focus through re-renders that do not change the order", () => {
    const { rerender } = render(<SortableList items={items} onReorder={() => undefined} />);
    const button = screen.getByRole("button", { name: "Move Gamma up" });
    button.focus();
    fireEvent.click(button);
    rerender(<SortableList items={[...items]} onReorder={() => undefined} disabled />);
    rerender(<SortableList items={[...items]} onReorder={() => undefined} disabled />);
    rerender(
      <SortableList
        items={[items[0]!, items[2]!, items[1]!]}
        onReorder={() => undefined}
        disabled
      />,
    );
    rerender(
      <SortableList items={[items[0]!, items[2]!, items[1]!]} onReorder={() => undefined} />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Gamma up" }));
  });

  test("disables every control while saving", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Move Beta up" }));
    expect(onReorder).not.toHaveBeenCalled();
  });
});
