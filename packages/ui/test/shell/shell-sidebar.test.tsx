import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SidebarProvider, SidebarTrigger } from "../../src/components/sidebar";
import { fixtureGroups, fixtureLogo } from "../../src/shell/fixtures";
import { ShellSidebar } from "../../src/shell/shell-sidebar";
import { stubMatchMedia } from "../support/dom";

beforeEach(() => stubMatchMedia((query) => query.includes("max-width")));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(pathname = "/dashboard", logo: typeof fixtureLogo | null = fixtureLogo) {
  return render(
    <SidebarProvider>
      <SidebarTrigger />
      <ShellSidebar
        mode="drawer"
        brand={{ name: "Admin", href: "/", ...(logo ? { logo } : {}) }}
        groups={fixtureGroups}
        pathname={pathname}
        navLabel="Admin"
        link={({ onClick, ...props }: React.ComponentProps<"a">) => (
          <a
            {...props}
            onClick={(event) => {
              event.preventDefault();
              onClick?.(event);
            }}
          />
        )}
      />
    </SidebarProvider>,
  );
}

describe("ShellSidebar as a drawer", () => {
  test("opens from the trigger and closes when a link is selected", async () => {
    mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).not.toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Certificates" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("marks the active link with aria-current", async () => {
    mount("/learn/x");
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    await screen.findByRole("dialog");
    const current = document.querySelectorAll("[aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe("My Learning");
  });

  test("shows only the brand name when no logo is given", async () => {
    mount("/dashboard", null);
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Admin" })).not.toBeNull();
  });
});
