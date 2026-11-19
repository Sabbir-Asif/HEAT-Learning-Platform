import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ShieldIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthLayout } from "../../src/shell/auth-layout";
import { BrandLink } from "../../src/shell/brand-link";
import {
  fixtureGroups,
  fixtureItems,
  fixtureLogo,
  fixturePartners,
} from "../../src/shell/fixtures";
import { NotificationsLink } from "../../src/shell/notifications-link";
import { PageError, PageLoading } from "../../src/shell/page-states";
import { PublicFooter } from "../../src/shell/public-footer";
import { PublicHeader } from "../../src/shell/public-header";
import { ShellMain, SkipLink } from "../../src/shell/skip-link";
import { ThemeSwitch } from "../../src/shell/theme-switch";
import { ThemedLogo } from "../../src/shell/themed-logo";
import { UserMenu } from "../../src/shell/user-menu";
import { capCount, initials, visibleGroups } from "../../src/shell/nav";
import { stubMatchMedia } from "../support/dom";

beforeEach(() => stubMatchMedia(() => false));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SkipLink and ShellMain", () => {
  test("the skip link targets the single main landmark", () => {
    render(
      <>
        <SkipLink />
        <ShellMain>content</ShellMain>
      </>,
    );
    const link = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(link.getAttribute("href")).toBe(`#${main.id}`);
    expect(main.getAttribute("tabindex")).toBe("-1");
  });
});

describe("page states", () => {
  test("loading announces itself and is busy", () => {
    const { container } = render(<PageLoading />);
    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  test("error offers retry", () => {
    const onRetry = vi.fn();
    render(<PageError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("NotificationsLink", () => {
  test("names the unread count and caps it", () => {
    const { rerender } = render(<NotificationsLink href="/n" count={3} />);
    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).not.toBeNull();
    rerender(<NotificationsLink href="/n" count={120} />);
    expect(screen.getByRole("link", { name: "Notifications, 99+ unread" })).not.toBeNull();
  });

  test("has a plain name without unread items", () => {
    render(<NotificationsLink href="/n" />);
    expect(screen.getByRole("link", { name: "Notifications" })).not.toBeNull();
  });
});

describe("brand and logo", () => {
  test("BrandLink links to the home page with the name", () => {
    render(<BrandLink name="HEAT" href="/home" logo={fixtureLogo} />);
    const link = screen.getByRole("link", { name: /HEAT/ });
    expect(link.getAttribute("href")).toBe("/home");
  });

  test("ThemedLogo renders both variants in auto tone and one when inverse", () => {
    const { container, rerender } = render(<ThemedLogo {...fixtureLogo} />);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    rerender(<ThemedLogo {...fixtureLogo} tone="inverse" />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(fixtureLogo.darkSrc);
  });
});

describe("nav helpers", () => {
  test("initials, capCount and visibleGroups", () => {
    expect(initials("Ada Lovelace King")).toBe("AK");
    expect(initials("ada")).toBe("A");
    expect(initials("  ")).toBe("");
    expect(capCount(0)).toBeUndefined();
    expect(capCount(100)).toBe("99+");
    expect(visibleGroups([{ label: "G", items: [{ ...fixtureItems[0]!, hidden: true }] }])).toEqual(
      [],
    );
  });
});

describe("PublicFooter", () => {
  test("renders columns, partners, legal links and a mailto link as a plain anchor", () => {
    render(
      <PublicFooter
        brand={{ name: "HEAT", description: "About" }}
        columns={[
          {
            title: "Contact",
            links: [
              { href: "mailto:a@b.c", label: "a@b.c" },
              { href: "/about", label: "About" },
            ],
          },
        ]}
        partners={fixturePartners}
        legal={[{ href: "/privacy", label: "Privacy" }]}
        copyright="2026"
      />,
    );
    expect(screen.getByRole("navigation", { name: "Contact" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "a@b.c" }).getAttribute("href")).toBe("mailto:a@b.c");
    expect(
      within(screen.getByRole("navigation", { name: "Legal" })).getAllByRole("link"),
    ).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Partners" }).querySelectorAll("li")).toHaveLength(3);
  });
});

describe("PublicHeader", () => {
  test("marks the active item and closes the mobile menu on selection", async () => {
    render(
      <PublicHeader
        brand={{ name: "HEAT", subtitle: "Training", href: "/", logos: [fixtureLogo] }}
        items={fixtureItems}
        pathname="/learn"
        actions={<span>actions</span>}
      />,
    );
    const desktop = screen.getByRole("navigation", { name: "Primary" });
    expect(desktop.querySelector("[aria-current='page']")?.textContent).toBe("My Learning");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobile = await screen.findByRole("navigation", { name: "Primary mobile" });
    fireEvent.click(within(mobile).getByRole("link", { name: "Certificates" }));
    expect(screen.queryByRole("navigation", { name: "Primary mobile" })).toBeNull();
  });
});

describe("AuthLayout", () => {
  test("renders the form area as the single main landmark beside the panel", () => {
    render(
      <AuthLayout
        brand={{ name: "HEAT", href: "/", logos: [fixtureLogo] }}
        panel={{ headline: "Welcome", points: [{ icon: ShieldIcon, label: "Safe" }] }}
        actions={<span>theme</span>}
      >
        <form aria-label="Sign in" />
      </AuthLayout>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "About the training" })).not.toBeNull();
    expect(screen.getByText("Safe")).not.toBeNull();
  });
});

describe("UserMenu and ThemeSwitch", () => {
  test("the user menu trigger shows initials and the account name", () => {
    render(
      <UserMenu
        name="Ada Lovelace"
        email="ada@example.org"
        items={[{ href: "/account", label: "Account", icon: ShieldIcon }]}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Ada Lovelace/ });
    expect(trigger.textContent).toContain("AL");
  });

  test("the theme switch is a labelled menu button", () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole("button", { name: "Choose theme" })).not.toBeNull();
  });
});

describe("fixtures", () => {
  test("groups contain all five items", () => {
    expect(fixtureGroups.flatMap((group) => group.items)).toHaveLength(5);
  });
});
