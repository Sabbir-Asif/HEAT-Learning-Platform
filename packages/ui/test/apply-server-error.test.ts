import { afterEach, describe, expect, test, vi } from "vitest";
import { applyServerError, leafPaths } from "../src/composites/apply-server-error";
import { fieldErrorCopy, genericFormMessage } from "../src/composites/form-errors";

function fakeForm(values: Record<string, unknown>) {
  return { setError: vi.fn(), getValues: vi.fn(() => values) };
}

const payload = (fields: { path: string; code: string }[]) => ({
  error: { code: "VALIDATION_FAILED", message: "x", requestId: "r", fields },
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("leafPaths", () => {
  test("lists dot paths of nested objects and arrays", () => {
    expect(
      leafPaths({
        email: "",
        address: { street: "", city: "" },
        items: [{ name: "" }, { name: "" }],
      }),
    ).toEqual(["email", "address.street", "address.city", "items.0.name", "items.1.name"]);
  });

  test("keeps an empty array or a null as a leaf", () => {
    expect(leafPaths({ tags: [], owner: null })).toEqual(["tags", "owner"]);
  });
});

describe("applyServerError", () => {
  test("sets a field error with the copy for its code", () => {
    const form = fakeForm({ email: "" });
    applyServerError(form, payload([{ path: "email", code: "required" }]));
    expect(form.setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: fieldErrorCopy.required,
    });
  });

  test("sets the form-level message on root.server for an unmatched path", () => {
    const form = fakeForm({ email: "" });
    applyServerError(form, payload([{ path: "ghost", code: "custom" }]));
    expect(form.setError).toHaveBeenCalledWith("root.server", {
      type: "server",
      message: genericFormMessage,
    });
  });

  test("does not mark a field invalid when the error has no fields", () => {
    const form = fakeForm({ email: "" });
    applyServerError(form, { error: { code: "RATE_LIMITED", message: "x", requestId: "r" } });
    expect(form.setError).toHaveBeenCalledTimes(1);
    expect(form.setError.mock.calls[0]?.[0]).toBe("root.server");
  });

  test("uses the names given in options instead of the form values", () => {
    const form = fakeForm({});
    applyServerError(form, payload([{ path: "email", code: "required" }]), {
      knownPaths: ["email"],
    });
    expect(form.setError.mock.calls[0]?.[0]).toBe("email");
  });

  test("focuses the first invalid field in DOM order, not in response order", () => {
    document.body.innerHTML = `
      <div data-slot="form-field" data-field-name="first"><input id="a" /></div>
      <div data-slot="form-field" data-field-name="second"><input id="b" /></div>
      <div data-slot="form-field" data-field-name="third"><input id="c" /></div>`;
    const form = fakeForm({ first: "", second: "", third: "" });
    applyServerError(
      form,
      payload([
        { path: "third", code: "required" },
        { path: "second", code: "required" },
      ]),
    );
    expect(document.activeElement?.id).toBe("b");
  });

  test("focuses a button when the control is not an input", () => {
    document.body.innerHTML = `
      <div data-slot="form-field" data-field-name="role"><button id="trigger" type="button"></button></div>`;
    const form = fakeForm({ role: "" });
    applyServerError(form, payload([{ path: "role", code: "required" }]));
    expect(document.activeElement?.id).toBe("trigger");
  });

  test("does not move focus when only a form-level message is set", () => {
    document.body.innerHTML = `<div data-slot="form-field" data-field-name="email"><input id="a" /></div>`;
    const form = fakeForm({ email: "" });
    applyServerError(form, { error: { code: "INTERNAL", message: "x", requestId: "r" } });
    expect(document.activeElement).toBe(document.body);
  });

  test("a payload that is not an error response gives the generic message", () => {
    const form = fakeForm({ email: "" });
    applyServerError(form, new Error("boom"));
    expect(form.setError).toHaveBeenCalledWith("root.server", {
      type: "server",
      message: genericFormMessage,
    });
  });
});
