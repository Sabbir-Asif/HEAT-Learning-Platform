import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { BottomBar } from "../../src/shell/bottom-bar";
import { fixtureItems } from "../../src/shell/fixtures";

afterEach(cleanup);

describe("BottomBar", () => {
  test("renders exactly five items", () => {
    render(<BottomBar items={fixtureItems} pathname="/dashboard" label="Learner mobile" />);
    const nav = screen.getByRole("navigation", { name: "Learner mobile" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
  });

  test("marks only the active item with aria-current", () => {
    render(
      <BottomBar items={fixtureItems} pathname="/learn/course/module" label="Learner mobile" />,
    );
    const current = screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("aria-current")).toBe("page");
    expect(current[0]?.textContent).toBe("My Learning");
  });

  test("marks nothing when no item matches", () => {
    render(<BottomBar items={fixtureItems} pathname="/elsewhere" label="Learner mobile" />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  test("renders through a custom link component", () => {
    function CustomLink(props: React.ComponentProps<"a">) {
      return <a data-custom="yes" {...props} />;
    }
    render(
      <BottomBar items={fixtureItems} pathname="/" label="Learner mobile" link={CustomLink} />,
    );
    expect(document.querySelectorAll("[data-custom]")).toHaveLength(5);
  });
});
