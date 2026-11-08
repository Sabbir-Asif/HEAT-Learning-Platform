import { describe, expect, test, vi } from "vitest";
import { changeLocale } from "../../src/i18n/change-locale";

function run(target: "bn" | "en", pathname: string, search = "", hash = "") {
  const writeCookie = vi.fn();
  const navigate = vi.fn();
  changeLocale({ target, pathname, search, hash, writeCookie, navigate });
  return { writeCookie, navigate };
}

describe("changeLocale", () => {
  test("stores the preference and lands on the same page in the other language", () => {
    const { writeCookie, navigate } = run("bn", "/en/courses/x", "?tab=2", "#notes");
    expect(writeCookie).toHaveBeenCalledExactlyOnceWith(
      "__Host-locale=bn; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/bn/courses/x?tab=2#notes");
  });

  test("writes the cookie before it navigates", () => {
    const order: string[] = [];
    changeLocale({
      target: "en",
      pathname: "/bn",
      search: "",
      hash: "",
      writeCookie: () => order.push("cookie"),
      navigate: () => order.push("navigate"),
    });
    expect(order).toEqual(["cookie", "navigate"]);
  });

  test.each([
    ["/bn", "", "", "/en"],
    ["/bn/", "?a=1", "", "/en?a=1"],
    ["/bn/x", "", "#top", "/en/x#top"],
    ["//evil.com", "", "", "/en/evil.com"],
    ["/\\evil.com", "", "", "/en"],
  ])("%s %s %s goes to %s", (pathname, search, hash, expected) => {
    expect(run("en", pathname, search, hash).navigate).toHaveBeenCalledWith(expected);
  });
});
