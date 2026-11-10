import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CaptchaField, captchaImageSource } from "../src/composites/captcha-field";

afterEach(cleanup);

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L9 9"/></svg>';

const renderField = (props: Partial<React.ComponentProps<typeof CaptchaField>> = {}) =>
  render(
    <CaptchaField
      status="ready"
      svg={svg}
      value=""
      onChange={() => undefined}
      onRefresh={() => undefined}
      supportContact="support@heat.example"
      {...props}
    />,
  );

describe("CaptchaField", () => {
  test("shows the image with an accessible name that names the purpose and the support contact", () => {
    renderField();

    const image = screen.getByRole("img");
    expect(image.getAttribute("alt")).toContain("Security check");
    expect(image.getAttribute("alt")).toContain("support@heat.example");
    expect(image.getAttribute("src")).toBe(captchaImageSource(svg));
  });

  test("builds a data uri without raw markup", () => {
    const source = captchaImageSource(svg);

    expect(source.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(source).not.toContain("<");
  });

  test("always shows the support contact", () => {
    renderField({ status: "loading", svg: undefined });

    expect(screen.getByText(/support@heat\.example/)).toBeTruthy();
  });

  test("the refresh button has an accessible name and calls back", () => {
    const onRefresh = vi.fn();
    renderField({ onRefresh });

    fireEvent.click(screen.getByRole("button", { name: "Get a new image" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test("the input is labelled and reports typing", () => {
    const onChange = vi.fn();
    renderField({ onChange });

    const input = screen.getByLabelText("Security check");
    fireEvent.change(input, { target: { value: "AB3K7W" } });

    expect(onChange).toHaveBeenCalledWith("AB3K7W");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("characters");
  });

  test("loading shows a busy placeholder instead of an image and disables refresh", () => {
    renderField({ status: "loading", svg: undefined });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading security check");
    expect(screen.getByRole("button", { name: "Get a new image" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  test("a load failure says so and the refresh button retries", () => {
    const onRefresh = vi.fn();
    renderField({ status: "error", svg: undefined, onRefresh });

    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Get a new image" }));
    expect(onRefresh).toHaveBeenCalled();
  });

  test("a field error marks the input invalid and is described", () => {
    renderField({ error: "The characters do not match." });

    const input = screen.getByLabelText("Security check");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    expect(screen.getByRole("alert").textContent).toBe("The characters do not match.");
  });
});
